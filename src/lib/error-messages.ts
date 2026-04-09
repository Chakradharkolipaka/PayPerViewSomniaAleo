import { AleoConnectErrorCode, AleoProofErrorCode } from "@/lib/aleo-wallet";
import { SomniaPayErrorCode } from "@/lib/somnia-pay";

export interface ErrorMessage {
  title: string;
  body: string;
  action: string;
  retryable: boolean;
  showHardReload: boolean;
}

export const ALEO_ERRORS: Record<AleoConnectErrorCode, ErrorMessage> = {
  not_installed: {
    title: "Leo Wallet not installed",
    body: "The Leo Wallet browser extension was not detected.",
    action: "Install Leo Wallet from leoapp.io, then refresh this page.",
    retryable: false,
    showHardReload: false,
  },
  dapps_disabled: {
    title: "dApps interaction is disabled",
    body: "Leo Wallet is blocking all dApp connections.",
    action: "Open Leo Wallet -> Settings -> dApps and turn on the toggle, then click Retry.",
    retryable: true,
    showHardReload: false,
  },
  wrong_network: {
    title: "Wrong network in Leo Wallet",
    body: "This app requires Aleo Testnet Beta.",
    action: "Open Leo Wallet and switch the network selector to Aleo Testnet Beta, then click Retry.",
    retryable: true,
    showHardReload: false,
  },
  user_rejected: {
    title: "Connection request rejected",
    body: "You dismissed the Leo Wallet connection popup.",
    action: "Click Connect Leo again and approve the request in the popup.",
    retryable: true,
    showHardReload: false,
  },
  stale_auth: {
    title: "Stale wallet authorization",
    body: "A previous connection left invalid authorization state.",
    action: "Open Leo Wallet -> Connected Sites and remove this site entry, then click Retry.",
    retryable: true,
    showHardReload: true,
  },
  timeout: {
    title: "Leo Wallet did not respond",
    body: "The connection request timed out after 30 seconds.",
    action: "Hard reload this page (Ctrl+Shift+R) and try connecting again.",
    retryable: false,
    showHardReload: true,
  },
  unknown: {
    title: "Leo Wallet connection failed",
    body: "An unexpected error occurred during the connection handshake.",
    action: "Open browser console (F12), capture the error details, and contact support.",
    retryable: true,
    showHardReload: true,
  },
};

export const SOMNIA_PAY_ERRORS: Record<SomniaPayErrorCode, ErrorMessage> = {
  insufficient_balance: {
    title: "Insufficient STT balance",
    body: "Your wallet does not have enough STT for this purchase.",
    action: "Fund your wallet from the Somnia faucet, then try again.",
    retryable: false,
    showHardReload: false,
  },
  already_paid: {
    title: "Already purchased",
    body: "Access appears to have been purchased earlier for this video.",
    action: "Refresh the page and continue to proof generation if the token appears.",
    retryable: false,
    showHardReload: false,
  },
  wrong_price: {
    title: "Payment amount mismatch",
    body: "The contract rejected the submitted payment value.",
    action: "Hard reload the page (Ctrl+Shift+R) to refresh pricing data, then retry.",
    retryable: false,
    showHardReload: true,
  },
  contract_paused: {
    title: "Contract is paused",
    body: "PayPerView contract execution is temporarily paused.",
    action: "Wait and retry later, or contact support if the issue persists.",
    retryable: true,
    showHardReload: false,
  },
  user_rejected: {
    title: "Transaction rejected",
    body: "You cancelled the MetaMask payment prompt.",
    action: "Click Pay again and confirm the transaction in MetaMask.",
    retryable: true,
    showHardReload: false,
  },
  network_error: {
    title: "Somnia network unreachable",
    body: "The app could not reach the configured Somnia RPC endpoint.",
    action: "Check connectivity and toggle the Somnia network in MetaMask, then retry.",
    retryable: true,
    showHardReload: false,
  },
  unknown: {
    title: "Transaction failed on-chain",
    body: "The payment transaction reverted for an unclassified reason.",
    action: "Open browser console (F12), copy tx hash and error details, and contact support.",
    retryable: true,
    showHardReload: false,
  },
};

export const ALEO_PROOF_ERRORS: Record<AleoProofErrorCode, ErrorMessage> = {
  invalid_address: {
    title: "Aleo address not ready",
    body: "Leo Wallet is connected but the Aleo address has not fully loaded yet.",
    action: "Wait 2-3 seconds and click Retry. Do not reconnect wallets; your payment is safe.",
    retryable: true,
    showHardReload: false,
  },
  sdk_unavailable: {
    title: "Leo Wallet SDK unavailable",
    body: "The proof execution method is missing from the current Leo adapter session.",
    action: "Hard-reload the page (Ctrl+Shift+R), reconnect Leo Wallet, and retry.",
    retryable: false,
    showHardReload: true,
  },
  execution_failed: {
    title: "Aleo proof execution failed",
    body: "Leo Wallet could not complete the proof execution request, often because record-read permission was not granted.",
    action: "In Leo Wallet, remove this site from Connected Sites, reconnect, approve On-Chain History/record access, then click Retry.",
    retryable: true,
    showHardReload: false,
  },
  bad_record_shape: {
    title: "Proof output format unrecognized",
    body: "Proof output did not match known formats for this app.",
    action: "Open browser console and copy [normalizeProofRecord] logs for support. Payment remains safe.",
    retryable: false,
    showHardReload: false,
  },
  unknown: {
    title: "Aleo proof generation failed",
    body: "Unexpected proof-generation error occurred after payment.",
    action: "Open browser console (F12), copy the full error, and contact support with the tx hash.",
    retryable: true,
    showHardReload: false,
  },
};
