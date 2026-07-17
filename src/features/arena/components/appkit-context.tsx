"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { bsc } from "@reown/appkit/networks";
import type { ReactNode } from "react";

export const reownProjectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const isAppKitConfigured = Boolean(reownProjectId);

if (reownProjectId) {
  createAppKit({
    adapters: [new EthersAdapter()],
    defaultNetwork: bsc,
    features: {
      analytics: true,
      email: false,
      onramp: false,
      socials: [],
      swaps: false,
    },
    metadata: {
      description: "The first JAVURO human signal arena.",
      icons: ["https://watcherorplayer.xyz/icon.png"],
      name: "Watcher or Player",
      url: "https://watcherorplayer.xyz",
    },
    networks: [bsc],
    projectId: reownProjectId,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#7ee0bd",
      "--w3m-border-radius-master": "2px",
      "--w3m-font-family": "Arial, Helvetica, sans-serif",
      "--w3m-qr-color": "#7ee0bd",
      "--w3m-z-index": 100,
    },
  });
}

export function AppKitContext({ children }: { children: ReactNode }) {
  return children;
}
