import { requestAleoCiphertext } from "@/lib/aleo-provider";
import { useEffect } from "react";

export type AleoConnectErrorCode =
  | "not_installed"
  | "dapps_disabled"
  | "wrong_network"
  | "user_rejected"
  | "stale_auth"
  | "unknown";

export class AleoConnectError extends Error {
  code: AleoConnectErrorCode;

  constructor(code: AleoConnectErrorCode, message: string) {
    super(message);
    this.name = "AleoConnectError";
    this.code = code;
  }
}

const REQUIRED_NETWORK = "testnetbeta";

async function waitForLeoWalletInjection(timeoutMs = 3000, pollMs = 100): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.leoWallet) return true;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    if (window.leoWallet) {
      return true;
    }
  }

  return false;
}

/**
 * connectLeoWallet
 * Connects Leo Wallet with strict error classification and network checks.
 */
export async function connectLeoWallet(): Promise<{ address: string; network: string }> {
  const injected = await waitForLeoWalletInjection(3000, 100);

  if (!injected || typeof window === "undefined" || !window.leoWallet) {
    throw new AleoConnectError(
      "not_installed",
      "Leo Wallet extension not found. Install it from leoapp.io, then refresh this page."
    );
  }

  console.debug("[aleo-wallet] window.leoWallet present:", !!window.leoWallet);
  console.debug("[aleo-wallet] requesting connection on network:", REQUIRED_NETWORK);

  let address = "";
  let network = "";

  try {
    const result = await window.leoWallet.connect(REQUIRED_NETWORK);
    address = result?.address ?? "";

    if (result?.network) {
      network = result.network;
    } else if (typeof window.leoWallet.requestNetwork === "function") {
      network = await window.leoWallet.requestNetwork();
    } else {
      network = REQUIRED_NETWORK;
    }

    console.debug("[aleo-wallet] connect result:", { address, network });
  } catch (err: unknown) {
    const msg = (err as Error)?.message?.toLowerCase() ?? "";
    let code: AleoConnectErrorCode = "unknown";
    let userMessage = "Leo Wallet connection failed.";

    if (msg.includes("user rejected") || msg.includes("rejected") || msg.includes("cancelled")) {
      code = "user_rejected";
      userMessage =
        "You cancelled the connection request. Click Connect and approve it in the Leo Wallet popup.";
    } else if (
      msg.includes("dapps") ||
      msg.includes("dapp") ||
      msg.includes("interaction") ||
      msg.includes("disabled")
    ) {
      code = "dapps_disabled";
      userMessage =
        "dApps interaction is disabled in Leo Wallet. Go to Settings -> dApps and enable it, then try again.";
    } else if (
      msg.includes("network") ||
      msg.includes("testnet") ||
      msg.includes("mainnet") ||
      msg.includes("chain")
    ) {
      code = "wrong_network";
      userMessage = "Your Leo Wallet is on the wrong network. Please switch to Aleo Testnet Beta.";
    } else if (
      msg.includes("unauthorized") ||
      msg.includes("not authorized") ||
      msg.includes("stale") ||
      msg.includes("permission")
    ) {
      code = "stale_auth";
      userMessage =
        "Your previous authorization is no longer valid. Remove this site from Leo Wallet -> Connected Sites, then reconnect.";
    }

    console.debug("[aleo-wallet] raw error:", err);
    console.debug("[aleo-wallet] classified as:", code);

    if (code === "unknown") {
      throw new AleoConnectError("unknown", `Leo Wallet error: ${(err as Error)?.message ?? "unknown"}`);
    }

    throw new AleoConnectError(code, userMessage);
  }

  if (network !== REQUIRED_NETWORK) {
    throw new AleoConnectError(
      "wrong_network",
      `Leo Wallet is on \"${network}\". Please switch to Aleo Testnet Beta in the wallet network selector.`
    );
  }

  if (!address || !address.startsWith("aleo1")) {
    throw new AleoConnectError(
      "stale_auth",
      "The wallet returned an invalid address. Remove this site from Leo Wallet -> Connected Sites and reconnect."
    );
  }

  return { address, network };
}

/**
 * useLeoWalletStatus
 * Polls wallet injection state and triggers callback on disconnect.
 */
export function useLeoWalletStatus(onDisconnect: () => void): void {
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof window !== "undefined" && !window.leoWallet) {
        onDisconnect();
      }
    }, 2000);

    return () => clearInterval(id);
  }, [onDisconnect]);
}

/**
 * src/lib/aleo-wallet.ts
 * Wrapper around Aleo SDK for ViewToken lifecycle (grant_view / consume_view).
 *
 * Transitions:
 *   - grant_view(viewer: address, video_id: u32, token_id: u256) → ViewToken record
 *   - consume_view(token: ViewToken) → consumed ViewToken record
 *
 * DEBUG: Check browser console if transitions fail.
 */

/**
 * grantViewToken
 * Calls grant_view transition to create a ViewToken for the viewer + video_id + token_id.
 * This happens after on-chain payment (PayPerView.pay) mints the AccessNFT.
 *
 * @param programId     - Aleo program ID (e.g., video_access_<network>)
 * @param viewerAddress - Aleo address string
 * @param videoId       - Video identifier (u32)
 * @param tokenId       - Somnia NFT token ID (u256)
 * @returns             - Serialized ViewToken record (to be consumed later)
 *
 * POPUP: "Generating Aleo proof in your wallet — please wait."
 * ERROR: "Aleo proof generation failed — check that your wallet is unlocked and connected."
 */
export async function grantViewToken(
  programId: string,
  viewerAddress: string,
  videoId: number,
  tokenId: bigint
): Promise<string> {
  try {
    // Call grant_view via Aleo SDK / Wallet integration
    // The wallet handles the proof internally and returns the record ciphertext
    const record = await requestAleoCiphertext({
      program: programId,
      transition: "grant_view",
      inputs: [viewerAddress, videoId.toString(), tokenId.toString()],
    });

    console.debug("[aleo-wallet] grantViewToken success", { programId, tokenId, record });
    return record;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[aleo-wallet] grantViewToken failed", msg);
    throw new Error(`Failed to grant view token: ${msg}`);
  }
}

/**
 * consumeViewToken
 * Calls consume_view transition to mark the ViewToken as spent.
 * Backend will submit this proof to complete the purchase.
 *
 * @param programId     - Aleo program ID
 * @param tokenRecord   - Serialized ViewToken record from grantViewToken
 * @returns             - Consumed record proof (for backend verification)
 *
 * POPUP: "Finalising access proof — please wait."
 * ERROR: "Failed to consume proof — check that your wallet is unlocked."
 */
export async function consumeViewToken(programId: string, tokenRecord: string): Promise<string> {
  try {
    // Call consume_view on the token
    const consumed = await requestAleoCiphertext({
      program: programId,
      transition: "consume_view",
      inputs: [tokenRecord],
    });

    console.debug("[aleo-wallet] consumeViewToken success", { consumed });
    return consumed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[aleo-wallet] consumeViewToken failed", msg);
    throw new Error(`Failed to consume view token: ${msg}`);
  }
}

