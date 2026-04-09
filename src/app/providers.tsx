"use client";

import * as React from "react";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider as AleoWalletProvider } from "@demox-labs/aleo-wallet-adapter-react";
import { WalletModalProvider } from "@demox-labs/aleo-wallet-adapter-reactui";
import { LeoWalletAdapter } from "@demox-labs/aleo-wallet-adapter-leo";
import { DecryptPermission, WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import "@demox-labs/aleo-wallet-adapter-reactui/styles.css";

import { getSelectedChain, getSelectedRpcUrl } from "@/constants/networks";

const selectedChain = getSelectedChain();
const selectedRpcUrl = getSelectedRpcUrl();
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const config = getDefaultConfig({
  appName: "Somnia Private Pay-Per-View",
  projectId: walletConnectProjectId,
  chains: [selectedChain],
  wallets: [
    {
      groupName: "Preferred",
      wallets: [metaMaskWallet, injectedWallet],
    },
    ...(walletConnectProjectId
      ? [
          {
            groupName: "Universal",
            wallets: [walletConnectWallet],
          },
        ]
      : []),
  ],
  transports: {
    [selectedChain.id]: http(selectedRpcUrl),
  },
  ssr: true,
});

const queryClient = new QueryClient();

const aleoWallets = [
  new LeoWalletAdapter({
    appName: "Private Pay-Per-View",
  }),
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <AleoWalletProvider
            wallets={aleoWallets}
            network={WalletAdapterNetwork.TestnetBeta}
            decryptPermission={DecryptPermission.UponRequest}
            autoConnect={false}
          >
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </AleoWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
