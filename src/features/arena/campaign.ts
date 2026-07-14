export type ArenaRole = "watcher" | "player";

export type City = {
  id: string;
  name: string;
  region: string;
  status: string;
  wallets: number;
  proofs: number;
  watchers: number;
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type RewardRule = {
  label: string;
  amount: string;
  description: string;
  live: boolean;
};

export const campaignStats = {
  phase: "Genesis Claim",
  walletCap: 10_000,
  claimedWallets: 0,
  rewardPerWallet: 100,
  pool: 1_000_000,
};

export const cities: City[] = [
  {
    id: "seoul",
    name: "Seoul",
    region: "KR",
    status: "Genesis city",
    wallets: 0,
    proofs: 0,
    watchers: 0,
    coordinates: {
      lat: 37.5665,
      lng: 126.978,
    },
  },
  {
    id: "nyc",
    name: "NYC",
    region: "US",
    status: "Waiting for signal",
    wallets: 0,
    proofs: 0,
    watchers: 0,
    coordinates: {
      lat: 40.7128,
      lng: -74.006,
    },
  },
  {
    id: "la",
    name: "LA",
    region: "US",
    status: "Waiting for signal",
    wallets: 0,
    proofs: 0,
    watchers: 0,
    coordinates: {
      lat: 34.0522,
      lng: -118.2437,
    },
  },
  {
    id: "chicago",
    name: "Chicago",
    region: "US",
    status: "Waiting for signal",
    wallets: 0,
    proofs: 0,
    watchers: 0,
    coordinates: {
      lat: 41.8781,
      lng: -87.6298,
    },
  },
];

export const rewardRules: RewardRule[] = [
  {
    label: "First Signal",
    amount: "100 JXRO",
    description: "Wallet, city, and role selected. Once per wallet.",
    live: true,
  },
  {
    label: "Daily Watcher",
    amount: "Signal Points",
    description: "Judge Real or Noise and help curate the arena.",
    live: true,
  },
  {
    label: "Daily Player",
    amount: "Signal Points",
    description: "Check in from your city and prepare Proof Logs.",
    live: true,
  },
  {
    label: "Future Daily JXRO",
    amount: "1-20 JXRO",
    description: "Unlocked after Genesis Claim stability is proven.",
    live: false,
  },
];

export const proofPrompts = [
  "Show a human signal after dark.",
  "Find a place in your city that still feels alive.",
  "Drop proof from somewhere AI cannot stand in for you.",
];
