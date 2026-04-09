import { ethers } from "ethers";
import { AleoConnectErrorCode } from "@/lib/aleo-wallet";
import { SomniaPayErrorCode, verifyContractDeployment } from "@/lib/somnia-pay";

export type PreFlightIssue = {
  code: AleoConnectErrorCode | SomniaPayErrorCode | "contract_not_deployed" | "minter_not_set";
  message: string;
};

export async function runPreFlightChecks(somniaProvider: ethers.Provider): Promise<PreFlightIssue[]> {
  const issues: PreFlightIssue[] = [];

  const w = typeof window !== "undefined" ? (window as Window & { leo?: unknown }) : undefined;
  if (!w || (!w.leoWallet && !w.leo)) {
    issues.push({
      code: "not_installed",
      message: "Leo Wallet extension not detected.",
    });
  }

  try {
    await verifyContractDeployment(somniaProvider);
  } catch (err) {
    const message = (err as Error)?.message ?? "Contract deployment verification failed.";
    issues.push({
      code: message.toLowerCase().includes("minter") ? "minter_not_set" : "contract_not_deployed",
      message,
    });
  }

  try {
    await somniaProvider.getBlockNumber();
  } catch {
    issues.push({
      code: "network_error",
      message: "Somnia RPC is unreachable. Check your internet connection.",
    });
  }

  console.debug("[preflight] issues found:", issues.length, issues);
  return issues;
}
