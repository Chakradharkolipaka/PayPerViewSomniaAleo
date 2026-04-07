const DEFAULT_ALEO_RPC = "https://api.explorer.provable.com/v1";

function toAleoU128Array(chunks) {
  if (!Array.isArray(chunks) || chunks.length !== 4) {
    throw new Error("viewKeyChunks must be [u128;4]");
  }
  return `[${chunks.map((c) => `${c}u128`).join(", ")}]`;
}

export async function submitGrantAccessToAleo({
  viewerAleoAddress,
  videoId,
  tokenId,
  viewKeyChunks,
}) {
  const programId = process.env.ALEO_PROGRAM_ID;
  const aleoPrivateKey = process.env.ALEO_PRIVATE_KEY;
  const aleoRpcUrl = process.env.ALEO_RPC_URL || DEFAULT_ALEO_RPC;

  if (!programId || !aleoPrivateKey) {
    throw new Error("Missing ALEO_PROGRAM_ID or ALEO_PRIVATE_KEY for grant_access execution");
  }

  const sdk = await import("@aleohq/sdk").catch(() => null);
  if (!sdk) {
    throw new Error(
      "@aleohq/sdk is not installed. Install it to execute Aleo grant_access from backend."
    );
  }

  const Account = sdk.Account || sdk?.default?.Account;
  const ProgramManager = sdk.ProgramManager || sdk?.default?.ProgramManager;

  if (!Account || !ProgramManager) {
    throw new Error("Unable to locate Account/ProgramManager exports from @aleohq/sdk");
  }

  const account = new Account({ privateKey: aleoPrivateKey });
  const manager = new ProgramManager(aleoRpcUrl, account, process.env.ALEO_NETWORK || "testnet");

  const inputs = [
    `${videoId}field`,
    `${tokenId}u64`,
    toAleoU128Array(viewKeyChunks),
    viewerAleoAddress,
  ];

  const execution = await manager.execute(programId, "grant_access", inputs, 1.2);

  const txHash =
    execution?.transactionId ||
    execution?.txId ||
    execution?.id ||
    (typeof execution === "string" ? execution : undefined);

  if (!txHash) {
    throw new Error("Aleo grant_access executed but no tx hash was returned");
  }

  return { txHash };
}
