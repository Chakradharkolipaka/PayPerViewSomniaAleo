export async function uploadToIPFS(): Promise<string> {
  throw new Error("IPFS is disabled for this project. Use Aleo encrypted_url records instead.");
}
