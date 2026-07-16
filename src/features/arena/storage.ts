import type { ArenaRole } from "./campaign";

const arenaStateKey = "watcher-or-player:arena-state";
const proofLogsKey = "watcher-or-player:proof-logs";
const legacyDataClearedKey = "watcher-or-player:legacy-data-cleared:v1";

export type ArenaState = {
  walletAddress: string;
  cityId: string;
  role: ArenaRole;
  firstSignalClaimed: boolean;
  claimedAt?: string;
  txHash?: string;
};

export type ProofLog = {
  id: string;
  walletAddress: string;
  cityName: string;
  role: "player";
  caption: string;
  imageDataUrl: string;
  createdAt: string;
  real: number;
  noise: number;
  reaction?: "real" | "noise";
};

export function clearLegacyMockData() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(legacyDataClearedKey)) {
    return;
  }

  window.localStorage.removeItem(arenaStateKey);
  window.localStorage.removeItem(proofLogsKey);
  window.localStorage.setItem(legacyDataClearedKey, new Date().toISOString());
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
