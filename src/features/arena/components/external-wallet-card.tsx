"use client";

import { useCallback, useEffect, useState } from "react";
import { bscChainIdHex } from "@/lib/wallet-config";

type ClaimState = {
  amount: string;
  failureReason: string | null;
  status: "PENDING" | "PROCESSING" | "SUBMITTED" | "PAID" | "FAILED" | "REJECTED";
  transactionHash: string | null;
};

type WalletState = {
  address: string;
  chainId: number;
  verifiedAt: string | null;
};

type WalletSnapshot = {
  claim: ClaimState | null;
  payoutEnabled: boolean;
  rewardAmount: string;
  wallet: WalletState | null;
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function ExternalWalletCard({
  compact = false,
  onWalletChange,
}: {
  compact?: boolean;
  onWalletChange: (address: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/wallet", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const nextSnapshot = (await response.json()) as WalletSnapshot;
    setSnapshot(nextSnapshot);
    onWalletChange(nextSnapshot.wallet?.address ?? "");
  }, [onWalletChange]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  async function connectAndVerify() {
    const provider = window.ethereum;

    if (!provider) {
      setError(
        "No external wallet was found. Open this page in MetaMask or Trust Wallet, or install a compatible browser wallet.",
      );
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];

      if (!address) {
        throw new Error("No wallet account was selected.");
      }

      await ensureBscNetwork(provider);
      const challengeResponse = await fetch("/api/wallet", {
        body: JSON.stringify({ address }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const challenge = (await challengeResponse.json().catch(() => null)) as {
        challengeId?: string;
        error?: string;
        message?: string;
      } | null;

      if (!challengeResponse.ok || !challenge?.challengeId || !challenge.message) {
        throw new Error(challenge?.error ?? "Wallet verification could not start.");
      }

      const signature = (await provider.request({
        method: "personal_sign",
        params: [challenge.message, address],
      })) as string;
      const verifyResponse = await fetch("/api/wallet/verify", {
        body: JSON.stringify({
          address,
          challengeId: challenge.challengeId,
          signature,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const verified = (await verifyResponse.json().catch(() => null)) as {
        error?: string;
        wallet?: WalletState;
      } | null;

      if (!verifyResponse.ok || !verified?.wallet) {
        throw new Error(verified?.error ?? "Wallet verification failed.");
      }

      onWalletChange(verified.wallet.address);
      const latest = await getWalletSnapshot();
      setSnapshot(latest);

      if (latest.payoutEnabled && !latest.claim) {
        await claimGenesisReward();
      }

      await refresh();
    } catch (caughtError) {
      setError(getWalletError(caughtError));
    } finally {
      setIsWorking(false);
    }
  }

  async function claimGenesisReward() {
    setIsWorking(true);
    setError("");

    try {
      const response = await fetch("/api/claims/genesis", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        claim?: ClaimState;
        error?: string;
      } | null;

      if (!response.ok && !payload?.claim) {
        throw new Error(payload?.error ?? "The Genesis transfer could not be completed.");
      }

      await refresh();
    } catch (caughtError) {
      setError(getWalletError(caughtError));
    } finally {
      setIsWorking(false);
    }
  }

  const wallet = snapshot?.wallet;
  const claim = snapshot?.claim;
  const canClaim = Boolean(wallet && snapshot?.payoutEnabled && !claim);

  return (
    <div
      className={`border ${compact ? "rounded-2xl border-zinc-800 bg-black/30 p-4" : "mt-5 rounded-lg border-zinc-800 bg-zinc-950 p-5"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#7ee0bd]">
            External wallet
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-white">
            {wallet ? shortenAddress(wallet.address) : "Not connected"}
          </p>
        </div>
        <span
          className={`mt-0.5 h-2.5 w-2.5 rounded-full ${wallet ? "bg-[#7ee0bd]" : "bg-zinc-700"}`}
          title={wallet ? "Verified" : "Not connected"}
        />
      </div>

      {wallet ? (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Ownership verified on BNB Smart Chain. JAVURO does not hold your keys.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Connect MetaMask, Trust Wallet, or another compatible external wallet. Signing is free and cannot move funds.
        </p>
      )}

      {claim ? <ClaimNotice claim={claim} /> : null}

      {!wallet ? (
        <button
          className="mt-5 h-11 w-full rounded-md bg-[#7ee0bd] px-4 text-sm font-bold text-[#07100d] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          disabled={isWorking}
          onClick={connectAndVerify}
          type="button"
        >
          {isWorking ? "Verify in wallet..." : "Connect external wallet"}
        </button>
      ) : canClaim ? (
        <button
          className="mt-5 h-11 w-full rounded-md bg-[#7ee0bd] px-4 text-sm font-bold text-[#07100d] disabled:cursor-not-allowed disabled:bg-zinc-800"
          disabled={isWorking}
          onClick={claimGenesisReward}
          type="button"
        >
          {isWorking ? "Sending JXRO..." : `Receive ${snapshot?.rewardAmount ?? "100"} JXRO`}
        </button>
      ) : !claim ? (
        <div className="mt-5 rounded-md border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100">
          Wallet verified. Genesis transfers will unlock when the Reward Wallet is activated.
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-xs leading-5 text-red-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ClaimNotice({ claim }: { claim: ClaimState }) {
  const isPaid = claim.status === "PAID";
  const isFailed = claim.status === "FAILED";

  return (
    <div
      className={`mt-4 rounded-md border px-4 py-3 ${
        isPaid
          ? "border-[#7ee0bd]/20 bg-[#7ee0bd]/10"
          : isFailed
            ? "border-red-400/20 bg-red-400/10"
            : "border-sky-300/20 bg-sky-300/10"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
        {isPaid ? `${claim.amount} JXRO received` : isFailed ? "Transfer needs review" : "Transfer submitted"}
      </p>
      {claim.transactionHash ? (
        <a
          className="mt-2 inline-block text-xs text-[#a7f3d8] underline"
          href={`https://bscscan.com/tx/${claim.transactionHash}`}
          rel="noreferrer"
          target="_blank"
        >
          View transaction
        </a>
      ) : null}
      {isFailed && claim.failureReason ? (
        <p className="mt-2 text-xs leading-5 text-red-100">{claim.failureReason}</p>
      ) : null}
    </div>
  );
}

async function getWalletSnapshot() {
  const response = await fetch("/api/wallet", { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as WalletSnapshot | { error?: string } | null;

  if (!response.ok || !payload || !("wallet" in payload)) {
    throw new Error(payload && "error" in payload ? payload.error : "Wallet state could not be loaded.");
  }

  return payload;
}

async function ensureBscNetwork(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: bscChainIdHex }],
    });
  } catch (error) {
    const code = getProviderErrorCode(error);

    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          blockExplorerUrls: ["https://bscscan.com"],
          chainId: bscChainIdHex,
          chainName: "BNB Smart Chain",
          nativeCurrency: { decimals: 18, name: "BNB", symbol: "BNB" },
          rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
        },
      ],
    });
  }
}

function getProviderErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? Number(error.code)
    : 0;
}

function getWalletError(error: unknown) {
  const code = getProviderErrorCode(error);

  if (code === 4001) {
    return "The wallet request was cancelled.";
  }

  return error instanceof Error ? error.message : "The wallet request could not be completed.";
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
