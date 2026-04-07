/**
 * src/lib/ppv-errors.ts
 * Centralized error classifier.
 * All user-facing error messages live here. Never surface raw JS errors to users.
 */

export const PPV_ERRORS = {
  WALLET_NOT_FOUND: "Wallet not detected. Please install Leo Wallet and MetaMask.",
  WRONG_NETWORK: "Please switch MetaMask to the Somnia Devnet network.",
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

/**
 * classifyError
 * Converts a raw error into a user-facing message.
 * Returns a string from PPV_ERRORS or a generic fallback.
 */
export function classifyError(err: unknown): string {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  
  if (msg.includes("user rejected")) return PPV_ERRORS.TX_REJECTED;
  if (msg.includes("insufficient")) return PPV_ERRORS.INSUFFICIENT_BALANCE;
  if (msg.includes("network")) return PPV_ERRORS.WRONG_NETWORK;
  if (msg.includes("wallet")) return PPV_ERRORS.WALLET_NOT_FOUND;
  if (msg.includes("aleo")) return PPV_ERRORS.ALEO_PROOF_FAILED;
  if (msg.includes("decrypt")) return PPV_ERRORS.DECRYPTION_FAILED;
  
  return PPV_ERRORS.TX_FAILED;
}
