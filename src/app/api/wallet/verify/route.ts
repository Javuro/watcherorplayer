import { NextResponse, type NextRequest } from "next/server";
import { verifyMessage, type Hex } from "viem";
import { getCurrentViewer } from "@/lib/firebase-session";
import { prisma } from "@/lib/prisma";
import { hasValidRequestOrigin } from "@/lib/request-security";
import { bscChainId, normalizeWalletAddress } from "@/lib/wallet-config";

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
    challengeId?: unknown;
    signature?: unknown;
  } | null;
  const address = normalizeWalletAddress(payload?.address);

  if (
    !address ||
    typeof payload?.challengeId !== "string" ||
    typeof payload.signature !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(payload.signature)
  ) {
    return NextResponse.json({ error: "Invalid wallet verification payload." }, { status: 400 });
  }

  const challenge = await prisma.walletChallenge.findUnique({
    where: { id: payload.challengeId },
  });

  if (
    !challenge ||
    challenge.userId !== viewer.id ||
    challenge.address !== address ||
    challenge.usedAt ||
    challenge.expiresAt <= new Date()
  ) {
    return NextResponse.json({ error: "This verification request has expired." }, { status: 410 });
  }

  const signatureIsValid = await verifyMessage({
    address,
    message: challenge.message,
    signature: payload.signature as Hex,
  }).catch(() => false);

  if (!signatureIsValid) {
    return NextResponse.json({ error: "The wallet signature is invalid." }, { status: 401 });
  }

  try {
    const wallet = await prisma.$transaction(async (transaction) => {
      const existingWallet = await transaction.wallet.findUnique({ where: { address } });

      if (existingWallet && existingWallet.userId !== viewer.id) {
        throw new Error("WALLET_ALREADY_LINKED");
      }

      await transaction.walletChallenge.update({
        data: { usedAt: new Date() },
        where: { id: challenge.id },
      });
      await transaction.wallet.updateMany({
        data: { isPrimary: false },
        where: { userId: viewer.id },
      });

      return transaction.wallet.upsert({
        create: {
          address,
          chainId: bscChainId,
          isPrimary: true,
          userId: viewer.id,
          verifiedAt: new Date(),
        },
        update: {
          chainId: bscChainId,
          isPrimary: true,
          verifiedAt: new Date(),
        },
        where: { address },
      });
    });

    return NextResponse.json({
      wallet: {
        address: wallet.address,
        chainId: wallet.chainId,
        verifiedAt: wallet.verifiedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WALLET_ALREADY_LINKED") {
      return NextResponse.json(
        { error: "This wallet is already connected to another Signal ID." },
        { status: 409 },
      );
    }

    throw error;
  }
}
