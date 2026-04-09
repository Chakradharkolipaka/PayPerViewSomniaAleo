/**
 * src/lib/ppv-errors.ts
 * Centralized error classifier.
 * All user-facing error messages live here. Never surface raw JS errors to users.
 */

export const PPV_ERRORS = {
  WALLET_NOT_FOUND: "Wallet not detected. Please install/enable an EVM wallet and Leo Wallet.",
  WRONG_NETWORK: "Please switch your EVM wallet to the Somnia Devnet network.",
  INSUFFICIENT_BALANCE: "Insufficient STT balance. You need at least 0.005 STT.",
  TX_REJECTED: "Transaction cancelled. You can try again.",
  TX_FAILED: "Transaction failed on-chain. Please try again or contact support.",
  NFT_NOT_OWNED: "Access token not found for your address. Purchase first.",
  NFT_CONSUMED: "This access token has already been used. Buy again to watch.",
  ALEO_PROOF_FAILED: "Aleo proof generation failed. Check your Aleo wallet connection.",
  DECRYPTION_FAILED: "Content decryption failed. Please contact support.",
  BACKEND_UNAVAILABLE: "Access verification service is unavailable. Try again shortly.",
  CONTENT_NOT_FOUND: "This video content was not found. Contact support.",
} as const;

export type PPVErrorKey = keyof typeof PPV_ERRORS;

export interface PPVErrorClassification {
  message: string;
  detailed: string;
  code: PPVErrorKey;
}

/**
 * classifyError
 * Converts a raw error into a user-facing message plus a detailed diagnostic string.
 */
export function classifyError(err: unknown): PPVErrorClassification {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";

  if (msg.includes("user rejected")) {
    return makeClassification("TX_REJECTED", err);
  }

  if (msg.includes("insufficient")) {
    return makeClassification("INSUFFICIENT_BALANCE", err);
  }

  if (msg.includes("network")) {
    return makeClassification("WRONG_NETWORK", err);
  }

  // Keep Aleo classification ahead of generic wallet checks so proof errors
  // are not mislabeled as "wallet not detected".
  if (msg.includes("aleo") || msg.includes("proof") || msg.includes("ciphertext") || msg.includes("record")) {
    return makeClassification("ALEO_PROOF_FAILED", err);
  }

  if (msg.includes("wallet")) {
    return makeClassification("WALLET_NOT_FOUND", err);
  }

  if (msg.includes("decrypt")) {
    return makeClassification("DECRYPTION_FAILED", err);
  }

  return {
    code: "TX_FAILED",
    message: PPV_ERRORS.TX_FAILED,
    detailed: isErrorLike(err) && err.message ? err.message : PPV_ERRORS.TX_FAILED,
  };
}

function makeClassification(code: PPVErrorKey, err: unknown): PPVErrorClassification {
  return {
    code,
    message: PPV_ERRORS[code],
    detailed: isErrorLike(err) && err.message ? err.message : PPV_ERRORS[code],
  };
}

function isErrorLike(value: unknown): value is Error {
  return typeof value === "object" && value !== null && "message" in value;
}
