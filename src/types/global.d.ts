// Type shim for the Leo Wallet browser extension injection.

interface LeoWalletConnectResult {
  address: string;
  network?: string;
}

interface LeoWalletAPI {
  connect(network: string): Promise<LeoWalletConnectResult>;
  disconnect(): Promise<void>;
  requestNetwork(): Promise<string>;
  getSelectedAddress(): Promise<string | null>;
}

declare global {
  interface Window {
    leoWallet?: LeoWalletAPI;
    __aleoPublicKey?: string;
  }
}

export {};