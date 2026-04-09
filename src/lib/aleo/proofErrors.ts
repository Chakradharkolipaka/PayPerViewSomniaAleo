export enum ProofError {
  WALLET_NOT_READY = "WALLET_NOT_READY",
  PROOF_CALL_FAILED = "PROOF_CALL_FAILED",
  PROOF_RECORD_INVALID = "PROOF_RECORD_INVALID",
  VERIFY_REJECTED = "VERIFY_REJECTED",
  UNKNOWN_PROOF_ERROR = "UNKNOWN_PROOF_ERROR",
}

export class ProofLayerError extends Error {
  code: ProofError;
  step: number;
  causeData?: unknown;

  constructor(code: ProofError, message: string, step: number, causeData?: unknown) {
    super(message);
    this.name = "ProofLayerError";
    this.code = code;
    this.step = step;
    this.causeData = causeData;
  }
}

export const PROOF_ERROR_MESSAGES: Record<ProofError, string> = {
  [ProofError.WALLET_NOT_READY]: "Payment received. Proof generation failed. [Retry]",
  [ProofError.PROOF_CALL_FAILED]: "Payment received. Proof generation failed. [Retry]",
  [ProofError.PROOF_RECORD_INVALID]: "Payment received. Proof generation failed. [Retry]",
  [ProofError.VERIFY_REJECTED]: "Payment received. Proof generation failed. [Retry]",
  [ProofError.UNKNOWN_PROOF_ERROR]: "Payment received. Proof generation failed. [Retry]",
};

export function toProofLayerError(err: unknown, step: number): ProofLayerError {
  if (err instanceof ProofLayerError) {
    return err;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const lowered = rawMessage.toLowerCase();

  // Prevent cross-phase leakage into wallet/payment labels.
  if (lowered.includes("wallet not detected") || lowered.includes("invalid payment")) {
    return new ProofLayerError(
      ProofError.UNKNOWN_PROOF_ERROR,
      `[step-${step}] ${rawMessage}`,
      step,
      err
    );
  }

  return new ProofLayerError(ProofError.UNKNOWN_PROOF_ERROR, `[step-${step}] ${rawMessage}`, step, err);
}
