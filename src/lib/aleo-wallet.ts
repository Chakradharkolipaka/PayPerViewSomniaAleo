export interface AleoProofResult {
  proofBytes: `0x${string}`;
  decryptedUrl: string;
  expiresAtBlock: number;
}

export async function connectLeoWallet(): Promise<string> {
  const provider = (globalThis as { leoWallet?: { connect?: () => Promise<string> } }).leoWallet;
  if (!provider?.connect) {
    throw new Error("Leo wallet provider not found. Install and unlock a Provable-compatible wallet.");
  }
  return provider.connect();
}

export async function generateAleoProofForVideo(videoId: number): Promise<AleoProofResult> {
  const provider = (globalThis as {
    leoWallet?: {
      generateVideoAccessProof?: (videoId: number) => Promise<AleoProofResult>;
    };
  }).leoWallet;

  if (!provider?.generateVideoAccessProof) {
    throw new Error(
      "Missing Leo proof method. Implement `generateVideoAccessProof(videoId)` in your Provable wallet bridge."
    );
  }

  const proof = await provider.generateVideoAccessProof(videoId);
  if (!proof.proofBytes || !proof.decryptedUrl) {
    throw new Error("Invalid proof payload from Leo wallet.");
  }

  return proof;
}
