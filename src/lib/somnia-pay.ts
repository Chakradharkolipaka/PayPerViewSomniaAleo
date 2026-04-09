import { ethers } from "ethers";
import { accessNftAddress, payPerViewAbi, payPerViewAddress, VIDEO_PRICE_WEI } from "@/constants";

export type SomniaPayErrorCode =
  | "insufficient_balance"
  | "already_paid"
  | "wrong_price"
  | "contract_paused"
  | "user_rejected"
  | "network_error"
  | "unknown";

export class SomniaPayError extends Error {
  code: SomniaPayErrorCode;

  constructor(code: SomniaPayErrorCode, message: string) {
    super(message);
    this.name = "SomniaPayError";
    this.code = code;
  }
}

export async function callPayForVideo(
  videoId: number,
  userBalance: bigint,
  onSubmitted?: (txHash: string) => void
): Promise<{ txHash: string; tokenId: bigint }> {
  if (!payPerViewAddress) {
    throw new SomniaPayError("unknown", "PayPerView contract address is not configured.");
  }

  if (userBalance < VIDEO_PRICE_WEI) {
    throw new SomniaPayError(
      "insufficient_balance",
      `Insufficient STT balance. You need 0.005 STT but have ${ethers.formatEther(userBalance)} STT.`
    );
  }

  if (typeof window === "undefined" || !(window as { ethereum?: unknown }).ethereum) {
    throw new SomniaPayError("network_error", "Ethereum provider not found in browser.");
  }

  const provider = new ethers.BrowserProvider((window as { ethereum: ethers.Eip1193Provider }).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(payPerViewAddress, payPerViewAbi, signer);

  let tx: ethers.TransactionResponse;

  try {
    tx = await contract.pay(BigInt(videoId), { value: VIDEO_PRICE_WEI });
  } catch (err: unknown) {
    const msg = (err as Error)?.message?.toLowerCase() ?? "";
    console.debug("[somnia-pay] tx send error:", err);

    if (msg.includes("user rejected") || msg.includes("denied")) {
      throw new SomniaPayError("user_rejected", "You rejected the transaction in MetaMask.");
    }
    if (msg.includes("network") || msg.includes("rpc") || msg.includes("fetch") || msg.includes("timeout")) {
      throw new SomniaPayError("network_error", "Somnia RPC is unreachable. Check your connection and retry.");
    }
    if (msg.includes("incorrect payment") || msg.includes("wrong value")) {
      throw new SomniaPayError("wrong_price", "Payment amount mismatch. Reload the page and retry.");
    }
    if (msg.includes("paused")) {
      throw new SomniaPayError("contract_paused", "Contract is currently paused. Try again later.");
    }

    throw new SomniaPayError("unknown", `Transaction failed: ${(err as Error)?.message ?? "unknown error"}`);
  }

  console.debug("[somnia-pay] tx submitted:", tx.hash);
  onSubmitted?.(tx.hash);

  let receipt: ethers.TransactionReceipt | null;
  try {
    receipt = await tx.wait(1);
  } catch (err: unknown) {
    const msg = (err as Error)?.message?.toLowerCase() ?? "";
    console.debug("[somnia-pay] wait error:", err);

    if (msg.includes("alreadypaid") || msg.includes("already paid") || msg.includes("already")) {
      throw new SomniaPayError("already_paid", "You have already purchased access for this video.");
    }
    if (msg.includes("incorrectpayment") || msg.includes("incorrect payment") || msg.includes("wrong value")) {
      throw new SomniaPayError("wrong_price", "Contract rejected the payment amount.");
    }
    if (msg.includes("paused")) {
      throw new SomniaPayError("contract_paused", "Contract is currently paused. Try again later.");
    }

    throw new SomniaPayError(
      "unknown",
      `On-chain revert: ${(err as Error)?.message ?? "unknown error"}. Tx hash: ${tx.hash}`
    );
  }

  if (!receipt || receipt.status !== 1) {
    throw new SomniaPayError("unknown", `Transaction confirmed with status 0. Tx: ${tx.hash}`);
  }

  const iface = new ethers.Interface(payPerViewAbi);
  let tokenId = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AccessMinted") {
        tokenId = parsed.args.tokenId as bigint;
        break;
      }
    } catch {
      // Ignore non-matching logs.
    }
  }

  console.debug("[somnia-pay] success. txHash:", tx.hash, "tokenId:", tokenId.toString());

  return {
    txHash: tx.hash,
    tokenId,
  };
}

export async function verifyContractDeployment(provider: ethers.Provider): Promise<void> {
  if (!payPerViewAddress || !accessNftAddress) {
    throw new Error("Contract addresses are not configured in NEXT_PUBLIC environment variables.");
  }

  const payCode = await provider.getCode(payPerViewAddress);
  if (payCode === "0x") {
    throw new Error(`PayPerView contract not found at ${payPerViewAddress}.`);
  }

  const nftCode = await provider.getCode(accessNftAddress);
  if (nftCode === "0x") {
    throw new Error(`AccessNFT contract not found at ${accessNftAddress}.`);
  }

  const nft = new ethers.Contract(accessNftAddress, ["function minter() view returns (address)"], provider);
  const minter = (await nft.minter()) as string;

  if (minter.toLowerCase() !== payPerViewAddress.toLowerCase()) {
    throw new Error(
      `AccessNFT minter is ${minter}, expected ${payPerViewAddress}. Run setMinter(payPerViewAddress).`
    );
  }

  console.debug("[contracts] deployment verified OK");
}
