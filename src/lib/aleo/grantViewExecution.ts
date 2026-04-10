import { Transaction, WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import type { AleoTransaction } from "@demox-labs/aleo-wallet-adapter-base";
import { ProofError, ProofLayerError } from "@/lib/aleo/proofErrors";

type TransactionRequester = (transaction: AleoTransaction) => Promise<unknown>;
type ExecutionRequester = (transaction: AleoTransaction) => Promise<unknown>;
type ProverMode = "local_only" | "remote_only" | "hybrid_prefer_local" | "hybrid_prefer_remote";

export interface GrantViewExecutionParams {
  publicKey: string | null | undefined;
  programId: string;
  videoId: number;
  tokenId: string;
  traceId?: string;
  requestExecution?: ExecutionRequester;
  requestTransaction?: TransactionRequester;
}

export interface GrantViewExecutionResult {
  transactionId: string;
}

const REMOTE_PROVER_URL = process.env.NEXT_PUBLIC_ALEO_REMOTE_PROVER_URL?.trim();
const PROVER_MODE =
  ((process.env.NEXT_PUBLIC_ALEO_PROVER_MODE || "local_only").toLowerCase() as ProverMode) || "local_only";

function createTraceId(): string {
  return `proof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  return String(err ?? "unknown error");
}

function classifyWalletFailure(messages: string[]): string {
  const merged = messages.join(" | ").toLowerCase();

  if (
    merged.includes("unknown error occured") ||
    merged.includes("unknown error occurred") ||
    merged.includes("wallettransactionerror")
  ) {
    return "adapter_incompatibility";
  }

  if (merged.includes("network") || merged.includes("chain")) {
    return "network_mismatch";
  }

  if (merged.includes("program") || merged.includes("function")) {
    return "program_mismatch";
  }

  if (merged.includes("input") || merged.includes("format") || merged.includes("u64") || merged.includes("field")) {
    return "input_mismatch";
  }

  if (merged.includes("payload") || merged.includes("transition") || merged.includes("schema")) {
    return "payload_schema_mismatch";
  }

  if (merged.includes("permission") || merged.includes("authorize") || merged.includes("denied")) {
    return "permission_auth_issue";
  }

  return "unknown";
}

function getWalletProvider(): Record<string, unknown> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const win = window as unknown as { leoWallet?: unknown; aleo?: unknown };
  if (win.leoWallet && typeof win.leoWallet === "object") {
    return win.leoWallet as Record<string, unknown>;
  }
  if (win.aleo && typeof win.aleo === "object") {
    return win.aleo as Record<string, unknown>;
  }

  return null;
}

async function tryMethodVariants(
  provider: Record<string, unknown>,
  methodNames: string[],
  payload: Record<string, unknown>
): Promise<unknown> {
  let lastError: unknown;

  for (const methodName of methodNames) {
    const method = provider[methodName];
    if (typeof method !== "function") {
      continue;
    }

    try {
      return await (method as (arg: Record<string, unknown>) => Promise<unknown>)(payload);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("No supported wallet authorization method found.");
}

async function tryRemoteProver(params: {
  publicKey: string;
  programId: string;
  functionName: string;
  inputs: string[];
  fee: number;
  traceId: string;
}): Promise<string | null> {
  if (!REMOTE_PROVER_URL) {
    return null;
  }

  const provider = getWalletProvider();
  if (!provider) {
    throw new Error("Remote prover requires a wallet provider with authorization methods.");
  }

  const authPayload = {
    address: params.publicKey,
    network: "testnetbeta",
    program: params.programId,
    functionName: params.functionName,
    inputs: params.inputs,
  };

  const feeAuthPayload = {
    address: params.publicKey,
    network: "testnetbeta",
    fee: params.fee,
    feePrivate: false,
  };

  const authorization = await tryMethodVariants(provider, ["requestAuthorization", "aleo_requestAuthorization"], authPayload);
  const feeAuthorization = await tryMethodVariants(
    provider,
    ["requestFeeAuthorization", "aleo_requestFeeAuthorization"],
    feeAuthPayload
  );

  const health = await fetch(`${REMOTE_PROVER_URL}/`, { method: "GET" });
  if (!health.ok) {
    throw new Error(`Remote prover health check failed (${health.status}).`);
  }

  const proveRes = await fetch(`${REMOTE_PROVER_URL}/prove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-proof-trace-id": params.traceId,
    },
    body: JSON.stringify({
      authorization,
      fee_authorization: feeAuthorization,
      broadcast: true,
    }),
  });

  if (!proveRes.ok) {
    throw new Error(`Remote prover returned ${proveRes.status} ${proveRes.statusText}.`);
  }

  const payload = (await proveRes.json().catch(() => null)) as
    | { transaction_id?: string; execution_id?: string; status?: string }
    | null;

  const txId = payload?.transaction_id?.trim() || payload?.execution_id?.trim();
  if (!txId) {
    throw new Error("Remote prover response is missing transaction_id/execution_id.");
  }

  return txId;
}

function extractTransactionId(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const direct = [
    value.transactionId,
    value.transactionID,
    value.txId,
    value.txID,
    value.executionId,
    value.id,
    value.result,
    value.data,
  ];

  for (const item of direct) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
    if (typeof item === "object" && item !== null) {
      const nested = extractTransactionId(item);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export async function grantViewExecution(
  params: GrantViewExecutionParams
): Promise<GrantViewExecutionResult> {
  const { publicKey, programId, videoId, tokenId, requestExecution, requestTransaction } = params;
  const traceId = params.traceId?.trim() || createTraceId();

  if (!publicKey || !publicKey.startsWith("aleo1")) {
    throw new ProofLayerError(
      ProofError.WALLET_NOT_READY,
      "[grantViewExecution:step-1] publicKey is not ready.",
      1,
      { publicKey: publicKey ?? null }
    );
  }

  if (!Number.isInteger(videoId) || videoId < 0) {
    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      "[grantViewExecution:step-2] Invalid videoId for grant_view.",
      2,
      { videoId }
    );
  }

  const normalizedTokenId = tokenId.trim();
  if (!/^\d+$/.test(normalizedTokenId)) {
    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      "[grantViewExecution:step-2] Invalid tokenId for grant_view.",
      2,
      { tokenId }
    );
  }

  const grantInputs = [publicKey, `${videoId}field`, `${normalizedTokenId}u64`];

  const networkConst = WalletAdapterNetwork.TestnetBeta;
  const functionName = "grant_view";
  const fee = 1000;

  const createRequestTx = (chainId: string) => ({
    address: publicKey,
    chainId,
    transitions: [
      {
        program: programId,
        functionName,
        inputs: grantInputs,
      },
    ],
    fee,
    feePrivate: false,
  });

  const tx = Transaction.createTransaction(
    publicKey,
    networkConst,
    programId,
    functionName,
    grantInputs,
    fee
  );

  console.group("GRANT_VIEW_PROBE");
  console.log("program_id:", programId);
  console.log("function:", functionName);
  console.log("network:", networkConst);
  console.log("fee:", fee);
  console.log("trace_id:", traceId);
  console.log("inputs (raw):", JSON.stringify(grantInputs, null, 2));
  console.log("requestTx (testnetbeta):", JSON.stringify(createRequestTx("testnetbeta"), null, 2));
  console.groupEnd();

  console.group("[grantViewExecution] step-3 wallet request");
  try {
    const txProbe = tx as unknown as {
      programId?: string;
      functionName?: string;
      network?: string;
      fee?: number;
      inputs?: unknown[];
      transitions?: Array<{ program?: string; functionName?: string; inputs?: unknown[] }>;
    };

    const probeProgramId = txProbe.programId ?? txProbe.transitions?.[0]?.program;
    const probeFunctionName = txProbe.functionName ?? txProbe.transitions?.[0]?.functionName;
    const probeNetwork = txProbe.network ?? (tx as unknown as { chainId?: string }).chainId;
    const probeInputs = txProbe.inputs ?? txProbe.transitions?.[0]?.inputs ?? [];
    const probeInput0 = probeInputs[0] as Record<string, unknown> | undefined;

    console.group("🔍 ALEO_PROBE_CRITICAL");
    console.log("Network Constant:", probeNetwork);
    console.log("Function Name:", probeFunctionName);
    console.log("Fee:", txProbe.fee ?? fee);
    console.log("Input Type:", typeof probeInputs[0]);
    console.log("Input Owner:", probeInput0?.owner);
    console.log("program_id:", probeProgramId);
    console.log("function:", probeFunctionName);
    console.log("network:", probeNetwork);
    console.log("fee:", txProbe.fee ?? fee);
    console.log("inputs (raw):", JSON.stringify(probeInputs, null, 2));
    console.groupEnd();

    if ((PROVER_MODE === "remote_only" || PROVER_MODE === "hybrid_prefer_remote") && REMOTE_PROVER_URL) {
      try {
        const remoteTxId = await tryRemoteProver({
          publicKey,
          programId,
          functionName,
          inputs: grantInputs,
          fee,
          traceId,
        });

        if (remoteTxId) {
          console.log("remote prover tx id:", remoteTxId);
          return { transactionId: remoteTxId.trim() };
        }
      } catch (remoteError) {
        const remoteMessage = normalizeErrorMessage(remoteError);
        console.warn("remote prover failed:", remoteMessage);

        if (PROVER_MODE === "remote_only") {
          throw new ProofLayerError(
            ProofError.PROOF_CALL_FAILED,
            `[grantViewExecution:step-3][trace:${traceId}] remote_prover_failed: ${remoteMessage}`,
            3,
            remoteError
          );
        }
      }
    }

    let walletRaw: unknown;
    const attemptErrors: string[] = [];

    const attemptMatrix: Array<{ label: string; run: () => Promise<unknown> }> = [];

    if (typeof requestTransaction === "function") {
      attemptMatrix.push({
        label: "requestTransaction(chainId=testnetbeta)",
        run: () => requestTransaction(createRequestTx("testnetbeta") as unknown as AleoTransaction),
      });
      attemptMatrix.push({
        label: "requestTransaction(chainId=testnet)",
        run: () => requestTransaction(createRequestTx("testnet") as unknown as AleoTransaction),
      });
      attemptMatrix.push({
        label: "requestTransaction(chainId=aleo:testnetbeta)",
        run: () => requestTransaction(createRequestTx("aleo:testnetbeta") as unknown as AleoTransaction),
      });
    }

    if (typeof requestExecution === "function") {
      attemptMatrix.push({
        label: "requestExecution(raw,chainId=testnetbeta)",
        run: () => requestExecution(createRequestTx("testnetbeta") as unknown as AleoTransaction),
      });
      attemptMatrix.push({
        label: "requestExecution(raw,chainId=testnet)",
        run: () => requestExecution(createRequestTx("testnet") as unknown as AleoTransaction),
      });
      attemptMatrix.push({
        label: "requestExecution(sdkTx)",
        run: () => requestExecution(tx),
      });
    }

    for (const attempt of attemptMatrix) {
      try {
        walletRaw = await attempt.run();
        console.log(`${attempt.label} raw:`, walletRaw);
      } catch (error) {
        const message = normalizeErrorMessage(error);
        attemptErrors.push(`${attempt.label}: ${message}`);
        console.warn(`${attempt.label} failed:`, error);
      }

      if (walletRaw) {
        const transactionId = extractTransactionId(walletRaw);
        if (transactionId) {
          return { transactionId: transactionId.trim() };
        }

        attemptErrors.push(`${attempt.label}: response_missing_transaction_id`);
        walletRaw = undefined;
      }
    }

    if (!attemptErrors.length) {
      attemptErrors.push("No wallet methods were available.");
    }

    if (!walletRaw) {
      const category = classifyWalletFailure(attemptErrors);
      throw new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        `[grantViewExecution:step-3][trace:${traceId}] ${category}: ${attemptErrors.join(" | ")}`,
        3,
        { traceId, category, attemptErrors }
      );
    }

    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      `[grantViewExecution:step-3][trace:${traceId}] unknown: wallet response could not be resolved to a transaction id.`,
      3,
      { traceId }
    );
  } catch (error) {
    if (error instanceof ProofLayerError) {
      throw error;
    }

    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      `[grantViewExecution:step-3] requestExecution failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      3,
      error
    );
  } finally {
    console.groupEnd();
  }
}
