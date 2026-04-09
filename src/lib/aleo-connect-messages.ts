import { AleoConnectErrorCode } from "@/lib/aleo-wallet";

export const CONNECT_ERROR_MESSAGES: Record<
  AleoConnectErrorCode,
  {
    title: string;
    action: string;
    retryable: boolean;
  }
> = {
  not_installed: {
    title: "Leo Wallet not found",
    action: "Install the Leo Wallet extension from leoapp.io, then refresh this page.",
    retryable: false,
  },
  dapps_disabled: {
    title: "dApps interaction is disabled",
    action: "Open Leo Wallet -> Settings -> dApps and enable the toggle. Then click Retry.",
    retryable: true,
  },
  wrong_network: {
    title: "Wrong network selected",
    action: "Open Leo Wallet -> Network selector -> choose Aleo Testnet Beta. Then click Retry.",
    retryable: true,
  },
  user_rejected: {
    title: "Connection request rejected",
    action: "Click Connect again and approve the request in the Leo Wallet popup.",
    retryable: true,
  },
  stale_auth: {
    title: "Stale authorization detected",
    action: "Open Leo Wallet -> Connected Sites -> remove this site. Then click Retry.",
    retryable: true,
  },
  unknown: {
    title: "Connection failed",
    action: "Check the browser console for details. Try refreshing the page.",
    retryable: true,
  },
};