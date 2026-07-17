import { NextResponse, type NextRequest } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getCurrentViewer } from "@/lib/firebase-session";
import { prisma } from "@/lib/prisma";
import { hasValidRequestOrigin } from "@/lib/request-security";
import {
  genesisCampaignKey,
  genesisRewardAmount,
  genesisWalletCap,
  isRewardTransferConfigured,
} from "@/lib/wallet-config";

export const dynamic = "force-dynamic";

const erc20TransferAbi = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export async function POST(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!isRewardTransferConfigured()) {
    return NextResponse.json(
      { error: "Genesis transfers are not active yet." },
      { status: 503 },
    );
  }

  let transferConfig: ReturnType<typeof getRewardTransferConfig>;

  try {
    transferConfig = getRewardTransferConfig();
  } catch {
    return NextResponse.json(
      { error: "Genesis transfer configuration is invalid." },
      { status: 503 },
    );
  }

  const [user, wallet, existingClaim] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewer.id } }),
    prisma.wallet.findFirst({
      orderBy: [{ isPrimary: "desc" }, { verifiedAt: "desc" }],
      where: { userId: viewer.id, verifiedAt: { not: null } },
    }),
    prisma.claim.findUnique({
      where: {
        campaignKey_userId: {
          campaignKey: genesisCampaignKey,
          userId: viewer.id,
        },
      },
    }),
  ]);

  if (existingClaim) {
    return NextResponse.json({ claim: serializeClaim(existingClaim) });
  }

  if (!user?.role || !user.cityName) {
    return NextResponse.json(
      { error: "Choose a role and city before claiming." },
      { status: 400 },
    );
  }

  if (!wallet) {
    return NextResponse.json(
      { error: "Verify an external wallet before claiming." },
      { status: 400 },
    );
  }

  let claim;

  try {
    claim = await prisma.$transaction(
      async (transaction) => {
        const allocatedCount = await transaction.claim.count({
          where: {
            campaignKey: genesisCampaignKey,
            status: { notIn: ["FAILED", "REJECTED"] },
          },
        });

        if (allocatedCount >= genesisWalletCap) {
          throw new Error("GENESIS_CAP_REACHED");
        }

        return transaction.claim.create({
          data: {
            amount: genesisRewardAmount,
            campaignKey: genesisCampaignKey,
            status: "PROCESSING",
            userId: viewer.id,
            walletId: wallet.id,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "GENESIS_CAP_REACHED") {
      return NextResponse.json(
        { error: "The Genesis wallet cap has been reached." },
        { status: 409 },
      );
    }

    const duplicate = await prisma.claim.findUnique({
      where: {
        campaignKey_userId: {
          campaignKey: genesisCampaignKey,
          userId: viewer.id,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json({ claim: serializeClaim(duplicate) });
    }

    throw new Error("The Genesis allocation could not be reserved.");
  }

  const { decimals, privateKey, rpcUrl, tokenAddress } = transferConfig;
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });
  let transactionHash: Hex | null = null;

  try {
    const simulation = await publicClient.simulateContract({
      abi: erc20TransferAbi,
      account,
      address: tokenAddress,
      args: [wallet.address as Address, parseUnits(genesisRewardAmount, decimals)],
      functionName: "transfer",
    });

    if (simulation.result !== true) {
      throw new Error("The token contract did not approve the transfer.");
    }

    transactionHash = await walletClient.writeContract(simulation.request);

    claim = await prisma.claim.update({
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        transactionHash,
      },
      where: { id: claim.id },
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      confirmations: 1,
      hash: transactionHash,
      timeout: 45_000,
    });

    claim = await prisma.claim.update({
      data:
        receipt.status === "success"
          ? { paidAt: new Date(), status: "PAID" }
          : { failureReason: "The token transfer reverted.", status: "FAILED" },
      where: { id: claim.id },
    });
  } catch (error) {
    if (!transactionHash) {
      claim = await prisma.claim.update({
        data: {
          failureReason: getTransferError(error),
          status: "FAILED",
        },
        where: { id: claim.id },
      });
    }
  }

  return NextResponse.json(
    { claim: serializeClaim(claim) },
    { status: claim.status === "FAILED" ? 502 : 200 },
  );
}

function getRewardTransferConfig() {
  const rpcUrl = process.env.BSC_RPC_URL;
  const rawTokenAddress = process.env.JXRO_TOKEN_ADDRESS;
  const rawPrivateKey = process.env.JXRO_REWARD_PRIVATE_KEY;

  if (!rpcUrl || !rawTokenAddress || !/^0x[0-9a-fA-F]{64}$/.test(rawPrivateKey ?? "")) {
    throw new Error("Invalid Reward Wallet configuration.");
  }

  const tokenAddress = getAddress(rawTokenAddress);

  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invalid token address.");
  }

  return {
    decimals: parseTokenDecimals(process.env.JXRO_TOKEN_DECIMALS),
    privateKey: rawPrivateKey as Hex,
    rpcUrl,
    tokenAddress,
  };
}

function parseTokenDecimals(value: string | undefined) {
  const decimals = Number.parseInt(value ?? "18", 10);

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("JXRO_TOKEN_DECIMALS must be between 0 and 36.");
  }

  return decimals;
}

function getTransferError(error: unknown) {
  const message = error instanceof Error ? error.message : "Token transfer failed.";
  return message.slice(0, 500);
}

function serializeClaim(claim: {
  amount: { toString(): string };
  failureReason: string | null;
  status: string;
  transactionHash: string | null;
}) {
  return {
    amount: claim.amount.toString(),
    failureReason: claim.failureReason,
    status: claim.status,
    transactionHash: claim.transactionHash,
  };
}
