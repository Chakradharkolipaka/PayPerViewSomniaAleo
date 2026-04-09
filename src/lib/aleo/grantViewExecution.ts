import { Transaction, WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import { ProofError, ProofLayerError } from "@/lib/aleo/proofErrors";

type RecordPlaintextRequester = (programId: string) => Promise<unknown>;
type ExecutionRequester = (transaction: unknown) => Promise<unknown>;

export interface GrantViewExecutionParams {
  publicKey: string | null | undefined;
  programId: string;
  requestRecordPlaintexts: RecordPlaintextRequester;
  requestExecution: ExecutionRequester;
}

export interface GrantViewExecutionResult {
  transactionId: string;
}

function extractTransactionId(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    return raw;
  }

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const direct = [value.transactionId, value.txId, value.id, value.result, value.data];

  for (const item of direct) {
    if (typeof item === "string" && item.trim()) {
      return item;
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

function selectPlaintextRecord(rawRecords: unknown): unknown | null {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return null;
  }

  const unspent = rawRecords.find((record) => {
    if (typeof record !== "object" || record === null) {
      return false;
    }

    const r = record as Record<string, unknown>;
    if (typeof r.spent === "boolean") {
      return r.spent === false;
    }

    const data = r.data;
    if (typeof data === "object" && data !== null && "spent" in data) {
      return (data as Record<string, unknown>).spent === false;
    }

    // If spent flag is missing, treat it as eligible.
    return true;
  });

  return unspent ?? rawRecords[0] ?? null;
}

export async function grantViewExecution(
  params: GrantViewExecutionParams
): Promise<GrantViewExecutionResult> {
  const { publicKey, programId, requestRecordPlaintexts, requestExecution } = params;

  if (!publicKey || !publicKey.startsWith("aleo1")) {
    throw new ProofLayerError(
      ProofError.WALLET_NOT_READY,
      "[grantViewExecution:step-1] publicKey is not ready.",
      1,
      { publicKey: publicKey ?? null }
    );
  }

  console.group("[grantViewExecution] step-2 requestRecordPlaintexts");
  let rawRecords: unknown;
  try {
    rawRecords = await requestRecordPlaintexts(programId);
    console.log("requestRecordPlaintexts raw:", rawRecords);
  } catch (error) {
    console.error("requestRecordPlaintexts throw:", error);
    console.groupEnd();
    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      `[grantViewExecution:step-2] Failed to fetch plaintext records: ${
        error instanceof Error ? error.message : String(error)
      }`,
      2,
      error
    );
  }
  console.groupEnd();

  const plaintextAccessRecord = selectPlaintextRecord(rawRecords);
  if (!plaintextAccessRecord) {
    throw new ProofLayerError(
      ProofError.PROOF_CALL_FAILED,
      "[grantViewExecution:step-2] No plaintext access record found.",
      2,
      rawRecords
    );
  }

  const networkConst = WalletAdapterNetwork.TestnetBeta;
  const functionName = "grant_view";
  const fee = 0;

  const tx = Transaction.createTransaction(
    publicKey,
    networkConst,
    programId,
    functionName,
    [plaintextAccessRecord],
    fee
  );

  console.group("GRANT_VIEW_PROBE");
  console.log("program_id:", programId);
  console.log("function:", functionName);
  console.log("network:", networkConst);
  console.log("fee:", fee);
  console.log("inputs (raw):", JSON.stringify([plaintextAccessRecord], null, 2));
  console.groupEnd();

  console.group("[grantViewExecution] step-3 requestExecution");
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

    const executionRaw = await requestExecution(tx);
    console.log("requestExecution raw:", executionRaw);
    const transactionId = extractTransactionId(executionRaw);

    if (!transactionId) {
      throw new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        "[grantViewExecution:step-3] requestExecution completed without transactionId.",
        3,
        executionRaw
      );
    }

    return { transactionId };
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
