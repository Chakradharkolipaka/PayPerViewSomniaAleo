import { WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import { ProofError, ProofLayerError, toProofLayerError } from "@/lib/aleo/proofErrors";

export type ProofRecord = {
  id: string;
  program_id: string;
  microcredits: string;
  spent: boolean;
  data: Record<string, unknown>;
};

export type FailureMode = "A" | "B" | "C" | "D";

export interface GrantViewTransaction {
  address: string;
  chainId: string;
  transitions: Array<{
    program: string;
    functionName: string;
    inputs: unknown[];
  }>;
  fee: number;
  feePrivate: boolean;
}

export interface ProofWalletAdapter {
  publicKey?: string | null;
  requestTransaction: (tx: GrantViewTransaction) => Promise<unknown>;
  transactionStatus: (txId: string) => Promise<unknown>;
  transitionViewKeys: (txId: string) => Promise<unknown>;
}

export interface ProveGrantOptions {
  adapter: ProofWalletAdapter;
  grantViewTx: GrantViewTransaction;
  verifyPayload?: Record<string, unknown>;
  verifyEndpoint?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  expectedNetwork?: WalletAdapterNetwork;
  deployedProgramNetwork?: WalletAdapterNetwork;
}

export interface ProveGrantResult {
  txId: string;
  status: string;
  rawTransitionViewKeys: unknown;
  normalizedRecord: ProofRecord;
}

export interface ProofDiagnostics {
  requestTransactionOutput?: unknown;
  requestTransactionError?: unknown;
  txId?: string;
  transactionStatusOutput?: unknown;
  transactionStatusError?: unknown;
  transitionViewKeysOutput?: unknown;
  transitionViewKeysError?: unknown;
  failureMode: FailureMode;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function extractTxId(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;
  const direct = [obj.transactionId, obj.txId, obj.id, obj.result, obj.data];
  for (const item of direct) {
    if (typeof item === "string" && item.trim()) return item;
    if (typeof item === "object" && item !== null) {
      const nested = extractTxId(item);
      if (nested) return nested;
    }
  }

  return null;
}

function extractStatus(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;
  const candidates = [obj.status, obj.state, obj.result];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return null;
}

function coerceTransitionViewKeys(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[0] : undefined;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return raw;
}

export function normalizeProofRecord(raw: unknown): ProofRecord | null {
  let candidate: unknown = raw;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const obj = candidate as Record<string, unknown>;
  if (
    typeof obj.id !== "string" ||
    typeof obj.program_id !== "string" ||
    typeof obj.microcredits !== "string" ||
    typeof obj.spent !== "boolean" ||
    typeof obj.data !== "object" ||
    obj.data === null ||
    Array.isArray(obj.data)
  ) {
    return null;
  }

  return {
    id: obj.id,
    program_id: obj.program_id,
    microcredits: obj.microcredits,
    spent: obj.spent,
    data: obj.data as Record<string, unknown>,
  };
}

export function classifyFailureMode(input: {
  requestTransactionError?: unknown;
  txId?: string | null;
  normalizedRecord?: ProofRecord | null;
  verifyRejected?: boolean;
}): FailureMode {
  if (input.requestTransactionError) return "A";
  if (!input.txId) return "B";
  if (!input.normalizedRecord) return "C";
  if (input.verifyRejected) return "D";
  return "D";
}

export async function diagnoseProofCalls(
  adapter: ProofWalletAdapter,
  grantViewTx: GrantViewTransaction
): Promise<ProofDiagnostics> {
  const diagnostics: ProofDiagnostics = { failureMode: "A" };

  try {
    diagnostics.requestTransactionOutput = await adapter.requestTransaction(grantViewTx);
    console.log("requestTransaction() raw output:", diagnostics.requestTransactionOutput);
  } catch (err) {
    diagnostics.requestTransactionError = err;
    diagnostics.failureMode = "A";
    console.log("requestTransaction() raw throw:", err);
    return diagnostics;
  }

  const txId = extractTxId(diagnostics.requestTransactionOutput);
  diagnostics.txId = txId ?? undefined;
  if (!txId) {
    diagnostics.failureMode = "B";
    return diagnostics;
  }

  try {
    diagnostics.transactionStatusOutput = await adapter.transactionStatus(txId);
    console.log("transactionStatus(txId) raw output:", diagnostics.transactionStatusOutput);
  } catch (err) {
    diagnostics.transactionStatusError = err;
    diagnostics.failureMode = "A";
    console.log("transactionStatus(txId) raw throw:", err);
    return diagnostics;
  }

  try {
    diagnostics.transitionViewKeysOutput = await adapter.transitionViewKeys(txId);
    console.log("transitionViewKeys(txId) raw output:", diagnostics.transitionViewKeysOutput);
  } catch (err) {
    diagnostics.transitionViewKeysError = err;
    diagnostics.failureMode = "A";
    console.log("transitionViewKeys(txId) raw throw:", err);
    return diagnostics;
  }

  const normalized = normalizeProofRecord(coerceTransitionViewKeys(diagnostics.transitionViewKeysOutput));
  diagnostics.failureMode = normalized ? "D" : "C";
  return diagnostics;
}

export function assertProgramNetworkMatch(
  expectedNetwork: WalletAdapterNetwork,
  deployedProgramNetwork: WalletAdapterNetwork
): void {
  if (expectedNetwork !== deployedProgramNetwork) {
    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      `[step-0] Wallet network mismatch: expected ${expectedNetwork}, deployed ${deployedProgramNetwork}`,
      0
    );
  }
}

export async function proveGrant(options: ProveGrantOptions): Promise<ProveGrantResult> {
  const {
    adapter,
    grantViewTx,
    verifyPayload = {},
    verifyEndpoint = "/api/verify",
    pollIntervalMs = 5_000,
    pollTimeoutMs = 90_000,
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    expectedNetwork,
    deployedProgramNetwork,
  } = options;

  if (expectedNetwork && deployedProgramNetwork) {
    assertProgramNetworkMatch(expectedNetwork, deployedProgramNetwork);
  }

  // 1) publicKey ready check
  if (!adapter.publicKey || !adapter.publicKey.startsWith("aleo1")) {
    throw new ProofLayerError(
      ProofError.WALLET_NOT_READY,
      "[step-1] publicKey is null/invalid at prove-call time.",
      1,
      { publicKey: adapter.publicKey ?? null }
    );
  }

  // 2) requestTransaction
  let txId = "";
  try {
    const requestRaw = await adapter.requestTransaction(grantViewTx);
    txId = extractTxId(requestRaw) ?? "";
    if (!txId) {
      throw new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        "[step-2] requestTransaction resolved without txId.",
        2,
        requestRaw
      );
    }
  } catch (err) {
    throw toProofLayerError(
      new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        `[step-2] requestTransaction failed: ${err instanceof Error ? err.message : String(err)}`,
        2,
        err
      ),
      2
    );
  }

  // 3) transactionStatus poll
  let finalStatus = "";
  const start = Date.now();
  try {
    while (Date.now() - start <= pollTimeoutMs) {
      const statusRaw = await adapter.transactionStatus(txId);
      const status = extractStatus(statusRaw) ?? "";
      finalStatus = status;

      if (status.toLowerCase() === "finalized") {
        break;
      }

      await sleepImpl(pollIntervalMs);
    }

    if (finalStatus.toLowerCase() !== "finalized") {
      throw new Error(`transactionStatus timeout. last status=${finalStatus || "unknown"}`);
    }
  } catch (err) {
    throw toProofLayerError(
      new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        `[step-3] transactionStatus polling failed: ${err instanceof Error ? err.message : String(err)}`,
        3,
        err
      ),
      3
    );
  }

  // 4) transitionViewKeys
  let transitionRaw: unknown;
  try {
    transitionRaw = await adapter.transitionViewKeys(txId);
  } catch (err) {
    throw toProofLayerError(
      new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        `[step-4] transitionViewKeys failed: ${err instanceof Error ? err.message : String(err)}`,
        4,
        err
      ),
      4
    );
  }

  // 5) normalize proof record
  let normalizedRecord: ProofRecord | null = null;
  try {
    const candidate = coerceTransitionViewKeys(transitionRaw);
    normalizedRecord = normalizeProofRecord(candidate);
    if (!normalizedRecord) {
      throw new Error("normalizeProofRecord returned null");
    }
  } catch (err) {
    throw toProofLayerError(
      new ProofLayerError(
        ProofError.PROOF_RECORD_INVALID,
        `[step-5] proof record normalization failed: ${err instanceof Error ? err.message : String(err)}`,
        5,
        { transitionRaw }
      ),
      5
    );
  }

  // 6) verify endpoint
  try {
    const response = await fetchImpl(verifyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...verifyPayload,
        txId,
        record: normalizedRecord,
      }),
    });

    if (!response.ok) {
      throw new Error(`verify rejected with status ${response.status}`);
    }
  } catch (err) {
    throw toProofLayerError(
      new ProofLayerError(
        ProofError.VERIFY_REJECTED,
        `[step-6] verify rejected: ${err instanceof Error ? err.message : String(err)}`,
        6,
        err
      ),
      6
    );
  }

  return {
    txId,
    status: finalStatus,
    rawTransitionViewKeys: transitionRaw,
    normalizedRecord,
  };
}
