import { requestAleoCiphertext } from "@/lib/aleo-provider";
import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { DecryptPermission, WalletAdapterNetwork, WalletReadyState } from "@demox-labs/aleo-wallet-adapter-base";

const DEBUG = process.env.NEXT_PUBLIC_ALEO_DEBUG === "true";

function log(...args: unknown[]) {
  if (DEBUG) {
    console.debug("[aleo-wallet]", ...args);
  }
}

export type AleoConnectErrorCode =
  | "not_installed"
  | "dapps_disabled"
  | "wrong_network"
  | "user_rejected"
  | "stale_auth"
  | "timeout"
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

/**
 * useAleoConnect
 * Adapter-based Leo Wallet connect hook with strict error classification.
 */
export function useAleoConnect() {
  const { connect, connected, publicKey, wallet, wallets, connecting, select, disconnect } = useWallet();

  useEffect(() => {
    if (wallet) return;

    const leoCandidate = wallets.find(
      (entry) =>
        entry.adapter.name.toLowerCase().includes("leo") &&
        (entry.readyState === WalletReadyState.Installed || entry.readyState === WalletReadyState.Loadable)
    );

    if (leoCandidate) {
      select(leoCandidate.adapter.name);
    }
  }, [wallet, wallets, select]);

  const connectAleo = useCallback(async (): Promise<{ address: string; network: string }> => {
    log("window.leoWallet present:", typeof window !== "undefined" && !!window.leoWallet);
    log("requesting connection on network:", REQUIRED_NETWORK);
    log("adapter selected:", wallet?.adapter?.name ?? "none");

    const hasInstalledLeo = wallets.some(
      (entry) =>
        entry.adapter.name.toLowerCase().includes("leo") &&
        (entry.readyState === WalletReadyState.Installed || entry.readyState === WalletReadyState.Loadable)
    );

    if (!wallet && !hasInstalledLeo) {
      throw new AleoConnectError(
        "not_installed",
        "Leo Wallet not found. Install it from leoapp.io and refresh this page."
      );
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new AleoConnectError(
            "timeout",
            "Leo Wallet did not respond within 30 seconds. Reload the page and try again."
          )
        );
      }, 30_000);
    });

    try {
      await Promise.race([
        connect(DecryptPermission.UponRequest, WalletAdapterNetwork.TestnetBeta),
        timeout,
      ]);
    } catch (err: unknown) {
      if (err instanceof AleoConnectError) {
        log("raw error:", err);
        log("classified as:", err.code);
        throw err;
      }

      const msg = (err as Error)?.message?.toLowerCase() ?? "";
      let code: AleoConnectErrorCode = "unknown";
      let message = "Leo Wallet connection failed.";

      if (msg.includes("user rejected") || msg.includes("cancelled") || msg.includes("denied")) {
        code = "user_rejected";
        message = "You cancelled the Leo Wallet connection request. Click Connect and approve the popup.";
      } else if (msg.includes("dapps") || msg.includes("interaction") || msg.includes("not allowed")) {
        code = "dapps_disabled";
        message = "dApps interaction is off in Leo Wallet. Enable it in Settings -> dApps and retry.";
      } else if (msg.includes("network") || msg.includes("wrong chain")) {
        code = "wrong_network";
        message = "Switch Leo Wallet to Aleo Testnet Beta and retry.";
      } else if (msg.includes("unauthorized") || msg.includes("stale") || msg.includes("not authorized")) {
        code = "stale_auth";
        message = "Authorization is stale. Remove this site from Leo Wallet -> Connected Sites and retry.";
      }

      log("raw error:", err);
      log("classified as:", code);
      throw new AleoConnectError(code, message);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const adapterNetwork = (wallet?.adapter as { network?: string } | undefined)?.network;
    if (adapterNetwork && adapterNetwork !== WalletAdapterNetwork.TestnetBeta) {
      throw new AleoConnectError(
        "wrong_network",
        `Leo Wallet returned network \"${adapterNetwork}\". Switch to Aleo Testnet Beta and retry.`
      );
    }

    const address = publicKey || wallet?.adapter.publicKey || "";
    if (!address || !address.startsWith("aleo1")) {
      throw new AleoConnectError(
        "stale_auth",
        "Connection succeeded but no valid Aleo address was returned. Remove this site from Connected Sites and retry."
      );
    }

    log("connect result:", { address, network: REQUIRED_NETWORK });
    return { address, network: REQUIRED_NETWORK };
  }, [connect, publicKey, wallet, wallets]);

  return {
    connectAleo,
    disconnectAleo: disconnect,
    connecting,
    connected,
    address: publicKey,
  };
}

/**
 * useLeoWalletStatus
 * Polls wallet connection state and triggers callback on disconnect.
 */
export function useLeoWalletStatus(onDisconnect: () => void): void {
  const { connected } = useWallet();
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (prevConnectedRef.current && !connected) {
        onDisconnect();
      }

      prevConnectedRef.current = connected;
    }, 2000);

    return () => clearInterval(id);
  }, [connected, onDisconnect]);
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

