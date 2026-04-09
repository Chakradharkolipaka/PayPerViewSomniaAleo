import { requestAleoCiphertext } from "@/lib/aleo-provider";
import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { DecryptPermission, WalletAdapterNetwork, WalletReadyState } from "@demox-labs/aleo-wallet-adapter-base";
import type { AleoTransaction } from "@demox-labs/aleo-wallet-adapter-base";

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

export type AleoProofErrorCode =
  | "invalid_address"
  | "sdk_unavailable"
  | "execution_failed"
  | "bad_record_shape"
  | "unknown";

export class AleoConnectError extends Error {
  code: AleoConnectErrorCode;

  constructor(code: AleoConnectErrorCode, message: string) {
    super(message);
    this.name = "AleoConnectError";
    this.code = code;
  }
}

export class AleoProofError extends Error {
  code: AleoProofErrorCode;

  constructor(code: AleoProofErrorCode, message: string) {
    super(message);
    this.name = "AleoProofError";
    this.code = code;
  }
}

const REQUIRED_NETWORK = "testnetbeta";
const CONFIGURED_PROGRAM_ID = process.env.NEXT_PUBLIC_ALEO_PROGRAM_ID || "video_access_testnet.aleo";
const REQUIRED_PROGRAM_ID = CONFIGURED_PROGRAM_ID.endsWith(".aleo")
  ? CONFIGURED_PROGRAM_ID
  : `${CONFIGURED_PROGRAM_ID}.aleo`;
const REQUIRED_DECRYPT_PERMISSION = DecryptPermission.OnChainHistory;

type ExecutionRequestFn = (transaction: AleoTransaction) => Promise<unknown>;

function normalizeProofRecord(result: unknown): string {
  // Shape A: plain string
  if (typeof result === "string" && result.length > 0) {
    return result;
  }

  if (typeof result !== "object" || result === null) {
    console.error("[normalizeProofRecord] unrecognized result:", result);
    throw new AleoProofError(
      "bad_record_shape",
      "Aleo proof output is not a recognized string/object format."
    );
  }

  const r = result as Record<string, unknown>;

  // Shape C: { outputs: [ { value: string } ] }
  if (Array.isArray(r.outputs) && r.outputs.length > 0) {
    const first = r.outputs[0] as Record<string, unknown>;
    if (typeof first?.value === "string" && first.value.length > 0) {
      return first.value;
    }
  }

  // Shape B: { execution: { transitions: [...] } }
  const exec = r.execution as Record<string, unknown> | undefined;
  if (exec && Array.isArray(exec.transitions)) {
    for (const transition of exec.transitions as Array<Record<string, unknown>>) {
      const outputs = transition.outputs as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(outputs) && outputs.length > 0) {
        const value = outputs[0]?.value;
        if (typeof value === "string" && value.length > 0) {
          return value;
        }
      }
    }
  }

  // Shape D: { transaction: { execution: { transitions: [...] } } }
  const tx = r.transaction as Record<string, unknown> | undefined;
  const txExec = tx?.execution as Record<string, unknown> | undefined;
  if (txExec && Array.isArray(txExec.transitions)) {
    for (const transition of txExec.transitions as Array<Record<string, unknown>>) {
      const outputs = transition.outputs as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(outputs) && outputs.length > 0) {
        const value = outputs[0]?.value;
        if (typeof value === "string" && value.length > 0) {
          return value;
        }
      }
    }
  }

  console.error("[normalizeProofRecord] unrecognized shape:", JSON.stringify(result, null, 2));
  throw new AleoProofError(
    "bad_record_shape",
    "Aleo proof output did not match any known record format."
  );
}

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
    log("requesting decrypt permission:", REQUIRED_DECRYPT_PERMISSION);
    log("requesting program access:", REQUIRED_PROGRAM_ID);
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
        connect(REQUIRED_DECRYPT_PERMISSION, WalletAdapterNetwork.TestnetBeta, [REQUIRED_PROGRAM_ID]),
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
  tokenId: bigint,
  requestExecution?: ExecutionRequestFn
): Promise<string> {
  console.group("[grantViewToken] proof attempt");
  console.log("viewerAddress:", viewerAddress);
  console.log("videoId:", videoId.toString());
  console.log("tokenId:", tokenId.toString());
  console.log("requestExecution type:", typeof requestExecution);
  console.groupEnd();

  if (!viewerAddress || typeof viewerAddress !== "string" || !viewerAddress.startsWith("aleo1")) {
    throw new AleoProofError(
      "invalid_address",
      `Leo Wallet address is not ready yet. Wait 2 seconds and click Retry (received: ${JSON.stringify(
        viewerAddress
      )}).`
    );
  }

  try {
    let result: unknown;

    if (typeof requestExecution === "function") {
      const tx = {
        address: viewerAddress,
        chainId: "testnetbeta",
        transitions: [
          {
            program: programId,
            functionName: "grant_view",
            inputs: [viewerAddress, `${videoId.toString()}field`, `${tokenId.toString()}u64`],
          },
        ],
        fee: 0.28,
        feePrivate: false,
      };

      result = await requestExecution(tx);
    } else {
      result = await requestAleoCiphertext({
        program: programId,
        transition: "grant_view",
        inputs: [viewerAddress, videoId.toString(), tokenId.toString()],
      });
    }

    console.group("[grantViewToken] raw result");
    console.log("type:", typeof result);
    console.log("keys:", typeof result === "object" && result !== null ? Object.keys(result as object) : "n/a");
    console.log("full:", JSON.stringify(result, null, 2));
    console.groupEnd();

    const record = normalizeProofRecord(result);

    console.debug("[aleo-wallet] grantViewToken success", { programId, tokenId, record });
    return record;
  } catch (err: unknown) {
    if (err instanceof AleoProofError) {
      console.error("[aleo-wallet] grantViewToken failed", err.message);
      throw err;
    }

    const msg = (err as Error)?.message?.toLowerCase() ?? "";
    console.error("[aleo-wallet] grantViewToken failed", msg || "unknown");

    if (msg.includes("rejected") || msg.includes("cancelled") || msg.includes("denied")) {
      throw new AleoProofError(
        "execution_failed",
        "You rejected the Aleo proof request in Leo Wallet. Click Retry and approve the execution popup."
      );
    }

    if (msg.includes("permission") || msg.includes("not authorized") || msg.includes("unauthorized")) {
      throw new AleoProofError(
        "execution_failed",
        "Leo Wallet blocked proof execution. Re-authorize this site in Leo Wallet and retry."
      );
    }

    if (msg.includes("program") || msg.includes("transition") || msg.includes("not found")) {
      throw new AleoProofError(
        "execution_failed",
        `Aleo program ${programId} was not found on testnetbeta. Verify deployment and NEXT_PUBLIC_ALEO_PROGRAM_ID.`
      );
    }

    throw new AleoProofError(
      "unknown",
      `Failed to grant view token: ${(err as Error)?.message ?? "Unknown error"}`
    );
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

