import type { ArenaRole } from "./campaign";

const arenaStateKey = "watcher-or-player:arena-state";
const proofLogsKey = "watcher-or-player:proof-logs";

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

export function loadArenaState(): ArenaState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.localStorage.getItem(arenaStateKey);

  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(rawState) as ArenaState;
  } catch {
    window.localStorage.removeItem(arenaStateKey);
    return null;
  }
}

export function saveArenaState(state: ArenaState) {
  window.localStorage.setItem(arenaStateKey, JSON.stringify(state));
}

export function clearArenaState() {
  window.localStorage.removeItem(arenaStateKey);
}

export function loadProofLogs(): ProofLog[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawLogs = window.localStorage.getItem(proofLogsKey);

  if (!rawLogs) {
    return [];
  }

  try {
    return JSON.parse(rawLogs) as ProofLog[];
  } catch {
    window.localStorage.removeItem(proofLogsKey);
    return [];
  }
}

export function saveProofLogs(logs: ProofLog[]) {
  window.localStorage.setItem(proofLogsKey, JSON.stringify(logs));
}

export function clearProofLogs() {
  window.localStorage.removeItem(proofLogsKey);
}

export function createLocalId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return `${prefix}_${hex.join("")}`;
}

export function createLocalWalletAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return `0x${hex.join("")}`;
}

export function createLocalTxHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return `0x${hex.join("")}`;
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
