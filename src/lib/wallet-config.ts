import { getAddress, isAddress } from "viem";

export const bscChainId = 56;
export const genesisCampaignKey =
  process.env.JXRO_CAMPAIGN_KEY ?? "first-signal-2026";
export const genesisRewardAmount =
  process.env.JXRO_REWARD_AMOUNT ?? "100";
export const genesisWalletCap = parsePositiveInteger(
  process.env.JXRO_PHASE_WALLET_CAP,
  10_000,
);

export function normalizeWalletAddress(value: unknown) {
  if (typeof value !== "string" || !isAddress(value)) {
    return null;
  }

  return getAddress(value);
}

export function isRewardTransferConfigured() {
  return Boolean(
    process.env.JXRO_CLAIMS_ENABLED === "true" &&
      process.env.JXRO_TOKEN_ADDRESS &&
      process.env.JXRO_REWARD_PRIVATE_KEY &&
      process.env.BSC_RPC_URL,
  );
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
