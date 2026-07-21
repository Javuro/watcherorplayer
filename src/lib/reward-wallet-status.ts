import "server-only";

import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { genesisRewardAmount } from "./wallet-config";

export type RewardWalletStatus = {
  chainId: number | null;
  claimsEnabled: boolean;
  configured: boolean;
  configuredDecimals: number | null;
  decimalsMatch: boolean | null;
  error: string | null;
  nativeBalance: string | null;
  ready: boolean;
  rewardWalletAddress: Address | null;
  rpcConfigured: boolean;
  signerConfigured: boolean;
  tokenAddress: Address | null;
  tokenBalance: string | null;
  tokenConfigured: boolean;
  tokenDecimals: number | null;
  tokenSymbol: string | null;
};

export async function getRewardWalletStatus(): Promise<RewardWalletStatus> {
  const rpcUrl = process.env.BSC_RPC_URL;
  const rawTokenAddress = process.env.JXRO_TOKEN_ADDRESS;
  const rawPrivateKey = process.env.JXRO_REWARD_PRIVATE_KEY;
  const rpcConfigured = Boolean(rpcUrl);
  const tokenConfigured = Boolean(rawTokenAddress);
  const signerConfigured = Boolean(rawPrivateKey);
  const configured = rpcConfigured && tokenConfigured && signerConfigured;
  const baseStatus = {
    chainId: null,
    claimsEnabled: process.env.JXRO_CLAIMS_ENABLED === "true",
    configured,
    configuredDecimals: null,
    decimalsMatch: null,
    error: null,
    nativeBalance: null,
    ready: false,
    rewardWalletAddress: null,
    rpcConfigured,
    signerConfigured,
    tokenAddress: null,
    tokenBalance: null,
    tokenConfigured,
    tokenDecimals: null,
    tokenSymbol: null,
  } satisfies RewardWalletStatus;

  if (!configured || !rpcUrl || !rawTokenAddress || !rawPrivateKey) {
    return baseStatus;
  }

  try {
    if (!/^0x[0-9a-fA-F]{64}$/.test(rawPrivateKey)) {
      throw new Error("Reward Wallet private key format is invalid.");
    }

    const tokenAddress = getAddress(rawTokenAddress);
    const account = privateKeyToAccount(rawPrivateKey as Hex);
    const configuredDecimals = parseConfiguredDecimals(
      process.env.JXRO_TOKEN_DECIMALS,
    );
    const client = createPublicClient({
      chain: bsc,
      transport: http(rpcUrl, { retryCount: 1, timeout: 5_000 }),
    });
    const [chainId, nativeBalance, tokenBalance, tokenDecimals, tokenSymbol] =
      await Promise.all([
        client.getChainId(),
        client.getBalance({ address: account.address }),
        client.readContract({
          abi: erc20Abi,
          address: tokenAddress,
          args: [account.address],
          functionName: "balanceOf",
        }),
        client.readContract({
          abi: erc20Abi,
          address: tokenAddress,
          functionName: "decimals",
        }),
        client.readContract({
          abi: erc20Abi,
          address: tokenAddress,
          functionName: "symbol",
        }),
      ]);
    const decimalsMatch = configuredDecimals === tokenDecimals;
    const hasGas = nativeBalance > BigInt(0);
    const hasReward =
      tokenBalance >= parseUnits(genesisRewardAmount, tokenDecimals);

    return {
      ...baseStatus,
      chainId,
      configuredDecimals,
      decimalsMatch,
      nativeBalance: formatEther(nativeBalance),
      ready: chainId === bsc.id && decimalsMatch && hasGas && hasReward,
      rewardWalletAddress: account.address,
      tokenAddress,
      tokenBalance: formatUnits(tokenBalance, tokenDecimals),
      tokenDecimals,
      tokenSymbol,
    };
  } catch (error) {
    return {
      ...baseStatus,
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Reward Wallet checks failed.",
    };
  }
}

function parseConfiguredDecimals(value: string | undefined) {
  const decimals = Number.parseInt(value ?? "18", 10);

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("JXRO_TOKEN_DECIMALS must be between 0 and 36.");
  }

  return decimals;
}
