import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createPublicClient, http, type Hex } from "viem";
import { bsc } from "viem/chains";
import { getCurrentViewer } from "@/lib/firebase-session";
import { prisma } from "@/lib/prisma";
import { hasValidRequestOrigin } from "@/lib/request-security";
import {
  bscChainId,
  genesisCampaignKey,
  genesisRewardAmount,
  isRewardTransferConfigured,
  normalizeWalletAddress,
} from "@/lib/wallet-config";

export const dynamic = "force-dynamic";

const challengeLifetimeMs = 5 * 60 * 1000;

export async function GET() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const wallet = await prisma.wallet.findFirst({
    orderBy: [{ isPrimary: "desc" }, { verifiedAt: "desc" }],
    where: { userId: viewer.id, verifiedAt: { not: null } },
  });
  let claim = wallet
    ? await prisma.claim.findUnique({
        where: {
          campaignKey_walletId: {
            campaignKey: genesisCampaignKey,
            walletId: wallet.id,
          },
        },
      })
    : null;

  if (
    claim?.status === "SUBMITTED" &&
    claim.transactionHash &&
    process.env.BSC_RPC_URL
  ) {
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL),
    });
    const receipt = await publicClient
      .getTransactionReceipt({ hash: claim.transactionHash as Hex })
      .catch(() => null);

    if (receipt) {
      claim = await prisma.claim.update({
        data:
          receipt.status === "success"
            ? { paidAt: new Date(), status: "PAID" }
            : { failureReason: "The token transfer reverted.", status: "FAILED" },
        where: { id: claim.id },
      });
    }
  }

  return NextResponse.json({
    claim: claim
      ? {
          amount: claim.amount.toString(),
          failureReason: claim.failureReason,
          status: claim.status,
          transactionHash: claim.transactionHash,
        }
      : null,
    payoutEnabled: isRewardTransferConfigured(),
    rewardAmount: genesisRewardAmount,
    wallet: wallet
      ? {
          address: wallet.address,
          chainId: wallet.chainId,
          verifiedAt: wallet.verifiedAt?.toISOString() ?? null,
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    address?: unknown;
  } | null;
  const address = normalizeWalletAddress(payload?.address);

  if (!address) {
    return NextResponse.json({ error: "A valid EVM wallet address is required." }, { status: 400 });
  }

  const walletOwner = await prisma.wallet.findUnique({ where: { address } });

  if (walletOwner && walletOwner.userId !== viewer.id) {
    return NextResponse.json(
      { error: "This wallet is already connected to another Signal ID." },
      { status: 409 },
    );
  }

  const now = new Date();
  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = new Date(now.getTime() + challengeLifetimeMs);
  const host = request.headers.get("host") ?? "watcherorplayer.xyz";
  const message = [
    "Watcher or Player wants you to verify this wallet.",
    "",
    `Domain: ${host}`,
    `Address: ${address}`,
    `Chain ID: ${bscChainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
    "",
    "This signature is free and does not authorize a transaction.",
  ].join("\n");

  await prisma.walletChallenge.deleteMany({
    where: {
      OR: [{ expiresAt: { lte: now } }, { userId: viewer.id, usedAt: null }],
    },
  });
  const challenge = await prisma.walletChallenge.create({
    data: {
      address,
      chainId: bscChainId,
      expiresAt,
      message,
      userId: viewer.id,
    },
  });

  return NextResponse.json({
    challengeId: challenge.id,
    expiresAt: expiresAt.toISOString(),
    message,
  });
}
