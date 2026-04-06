import type { Chain } from "viem";

export const somniaTestnet = {
  id: 50312,
  name: "Somnia Dream Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "STT",
    symbol: "STT",
  },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network/"] },
    public: { http: ["https://dream-rpc.somnia.network/"] },
  },
  blockExplorers: { default: { name: "Somnia Explorer", url: "https://shannon-explorer.somnia.network/" } },
} as const satisfies Chain;

export function getSelectedChain(): Chain {
  return somniaTestnet;
}

export function getSelectedRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || "https://dream-rpc.somnia.network/";
}
