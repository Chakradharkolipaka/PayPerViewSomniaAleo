import { Transaction, WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import type { AleoTransaction } from "@demox-labs/aleo-wallet-adapter-base";
import { ProofError, ProofLayerError } from "@/lib/aleo/proofErrors";

type TransactionRequester = (transaction: AleoTransaction) => Promise<unknown>;
type ExecutionRequester = (transaction: AleoTransaction) => Promise<unknown>;

export interface GrantViewExecutionParams {
  publicKey: string | null | undefined;
  programId: string;
  videoId: number;
  tokenId: string;
  requestExecution?: ExecutionRequester;
  requestTransaction?: TransactionRequester;
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

export async function grantViewExecution(
  params: GrantViewExecutionParams
): Promise<GrantViewExecutionResult> {
  const { publicKey, programId, videoId, tokenId, requestExecution, requestTransaction } = params;

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
  const fee = 0.28;

  const requestTx = {
    address: publicKey,
    chainId: "testnetbeta",
    transitions: [
      {
        program: programId,
        functionName,
        inputs: grantInputs,
      },
    ],
    fee,
    feePrivate: false,
  };

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
  console.log("inputs (raw):", JSON.stringify(grantInputs, null, 2));
  console.log("requestTx:", JSON.stringify(requestTx, null, 2));
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

    let walletRaw: unknown;
    let lastError: unknown;

    if (typeof requestTransaction === "function") {
      try {
        walletRaw = await requestTransaction(requestTx as unknown as AleoTransaction);
        console.log("requestTransaction raw:", walletRaw);
      } catch (error) {
        lastError = error;
        console.warn("requestTransaction failed:", error);
      }
    }

    if (!walletRaw && typeof requestExecution === "function") {
      try {
        walletRaw = await requestExecution(requestTx as unknown as AleoTransaction);
        console.log("requestExecution(rawTx) raw:", walletRaw);
      } catch (error) {
        lastError = error;
        console.warn("requestExecution(rawTx) failed:", error);
      }
    }

    if (!walletRaw && typeof requestExecution === "function") {
      try {
        walletRaw = await requestExecution(tx);
        console.log("requestExecution(sdkTx) raw:", walletRaw);
      } catch (error) {
        lastError = error;
        console.warn("requestExecution(sdkTx) failed:", error);
      }
    }

    if (!walletRaw) {
      throw new ProofLayerError(
        ProofError.PROOF_CALL_FAILED,
        `[grantViewExecution:step-3] Wallet request failed: ${
          lastError instanceof Error ? lastError.message : String(lastError ?? "No wallet method available")
        }`,
        3,
        lastError
      );
    }

    const executionRaw = walletRaw;
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
