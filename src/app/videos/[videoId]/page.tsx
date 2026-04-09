"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PopupBanner } from "@/components/PopupBanner";
import { DebugPanel } from "@/components/DebugPanel";
import { useWalletState } from "@/context/wallet-state";
import {
  SOMNIA_CHAIN_ID,
  VIDEO_PRICE_WEI,
  payPerViewAddress,
  accessNftAddress,
  SOMNIA_RPC,
  accessNftAbi,
} from "@/constants";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { AleoConnectError, AleoProofError } from "@/lib/aleo-wallet";
import { decryptAndPlay } from "@/lib/decrypt";
import { classifyError } from "@/lib/ppv-errors";
import { ALEO_ERRORS, ALEO_PROOF_ERRORS, SOMNIA_PAY_ERRORS } from "@/lib/error-messages";
import { callPayForVideo, SomniaPayError } from "@/lib/somnia-pay";
import { runPreFlightChecks } from "@/lib/preflight";
import { grantViewExecution } from "@/lib/aleo/grantViewExecution";
import { ethers } from "ethers";

type ViewStep =
  | "idle"
  | "connecting"
  | "paying"
  | "tx-pending"
  | "minting"
  | "proving"
  | "consuming"
  | "verifying"
  | "playing"
  | "error";

type VideoMeta = {
  title: string;
  description: string;
  creator: string;
  priceSTT: string;
};

export default function VideoWatchPage({ params }: { params: { videoId: string } }) {
  const videoId = Number(params.videoId);
  const aleoProgramId = process.env.NEXT_PUBLIC_ALEO_PROGRAM_ID || "video_access_testnet.aleo";
  const [video, setVideo] = useState<VideoMeta | null>(null);

  // Somnia wallet (via wagmi)
  const { address: somniaAddress, isConnected: somniaConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { requestExecution, requestTransaction } = useWallet();

  // Aleo + Somnia state management
  const {
    aleoAddress,
    aleoConnected,
    bothConnected,
    walletReadyError,
    connectAleo,
    disconnectAleo,
    switchToSomnia,
    addEvent,
    events,
  } = useWalletState();

  // State machine
  const [viewStep, setViewStep] = useState<ViewStep>("idle");
  const [stepMessage, setStepMessage] = useState<string>("Ready to purchase access");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorAction, setErrorAction] = useState<string>("");
  const [lastSomniaTxHash, setLastSomniaTxHash] = useState<string>("");
  const [lastAleoProofId, setLastAleoProofId] = useState<string>("");
  const [tokenId, setTokenId] = useState<string>("");
  const [decryptedUrl, setDecryptedUrl] = useState<string>("");
  const [preflightIssues, setPreflightIssues] = useState<string[]>([]);

  useEffect(() => {
    async function loadVideoMeta() {
      try {
        const res = await fetch(`/api/video-meta/${videoId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load video metadata (${res.status})`);
        }

        const payload = (await res.json()) as VideoMeta;
        setVideo(payload);
      } catch (err) {
        const classified = classifyError(err);
        setViewStep("error");
        setStepMessage(classified.message);
        setErrorMessage(classified.detailed);
        setErrorAction("Refresh and try again. If this persists, contact support.");
      }
    }

    loadVideoMeta();
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;

    async function checkPreflight() {
      try {
        const provider = new ethers.JsonRpcProvider(SOMNIA_RPC);
        const issues = await runPreFlightChecks(provider);

        if (cancelled) return;

        if (issues.length > 0) {
          setPreflightIssues(issues.map((issue) => issue.message));
          setViewStep("error");
          setStepMessage("Pre-flight checks failed");
          setErrorMessage(issues.map((issue) => issue.message).join(" | "));
          setErrorAction("Resolve the blocking issues shown below before connecting or paying.");
          addEvent(`Pre-flight blockers: ${issues.length}`);
        } else {
          setPreflightIssues([]);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Pre-flight checks failed.";
        setPreflightIssues([message]);
        setViewStep("error");
        setStepMessage("Pre-flight checks failed");
        setErrorMessage(message);
        setErrorAction("Check RPC/environment configuration and retry.");
      }
    }

    void checkPreflight();

    return () => {
      cancelled = true;
    };
  }, [addEvent]);

  // Somnia contract state
  const { data: balanceData } = useBalance({ address: somniaAddress });

  // Read AccessNFT ownership (check if already consumed)
  const { data: nftOwner } = useReadContract({
    address: accessNftAddress,
    abi: accessNftAbi,
    functionName: "ownerOf",
    args: [BigInt(tokenId) || 0n],
    query: { enabled: Boolean(accessNftAddress && tokenId) },
  });

  const { data: isConsumed } = useReadContract({
    address: accessNftAddress,
    abi: accessNftAbi,
    functionName: "consumed",
    args: [BigInt(tokenId) || 0n],
    query: { enabled: Boolean(accessNftAddress && tokenId) },
  });

  // Balance check
  const hasEnoughBalance = useMemo(() => {
    if (!balanceData || !somniaConnected) return false;
    return balanceData.value >= VIDEO_PRICE_WEI;
  }, [balanceData, somniaConnected]);

  // Network check
  const onWrongNetwork = somniaConnected && chainId !== SOMNIA_CHAIN_ID;

  // Explorer URL
  const explorerUrl = "https://explorer.somnia.network/";

  const isRecordPermissionError = (message: string) => {
    const lowered = message.toLowerCase();
    return (
      lowered.includes("permission not granted") ||
      lowered.includes("walletrecordserror") ||
      lowered.includes("on-chain history") ||
      lowered.includes("connected sites") ||
      lowered.includes("not authorized")
    );
  };

  const classifyProofError = (err: unknown): AleoProofError => {
    if (err instanceof AleoProofError) {
      return err;
    }

    const rawMessage = err instanceof Error ? err.message : String(err ?? "unknown");
    const lowered = rawMessage.toLowerCase();

    if (isRecordPermissionError(rawMessage)) {
      return new AleoProofError(
        "execution_failed",
        "Leo Wallet denied or revoked record-read permission for this site/session."
      );
    }

    if (lowered.includes("publickey") || lowered.includes("address") || lowered.includes("wallet not ready")) {
      return new AleoProofError("invalid_address", rawMessage);
    }

    if (
      lowered.includes("sdk") ||
      lowered.includes("not a function") ||
      lowered.includes("execution methods are unavailable")
    ) {
      return new AleoProofError("sdk_unavailable", rawMessage);
    }

    if (
      lowered.includes("wallettransactionerror") ||
      lowered.includes("requestexecution failed") ||
      lowered.includes("unknown error occurred") ||
      lowered.includes("transaction error")
    ) {
      return new AleoProofError("execution_failed", rawMessage);
    }

    if (
      lowered.includes("no plaintext access record") ||
      lowered.includes("record format") ||
      lowered.includes("unrecognized")
    ) {
      return new AleoProofError("bad_record_shape", rawMessage);
    }

    return new AleoProofError("unknown", `Aleo proof generation failed unexpectedly: ${rawMessage}`);
  };

  /**
   * Step 0: Connect Wallets
   */
  const handleConnectWallets = async () => {
    if (onWrongNetwork) {
      setViewStep("connecting");
      setStepMessage("Switching to Somnia network...");
      addEvent("User clicked: switch to Somnia");
      try {
        await switchToSomnia();
        addEvent("Network switched successfully");
      } catch (err) {
        const classified = classifyError(err);
        setErrorMessage(classified.message);
        setViewStep("error");
        setStepMessage(classified.message);
      }
      return;
    }

    if (!aleoConnected) {
      setViewStep("connecting");
      setStepMessage("Connecting Aleo wallet...");
      addEvent("User clicked: connect Aleo");
      try {
        await connectAleo();
        addEvent("Aleo wallet connected");
      } catch (err) {
        const code = err instanceof AleoConnectError ? err.code : "unknown";
        const mapped = ALEO_ERRORS[code];
        setErrorMessage(mapped.body);
        setErrorAction(mapped.action + (mapped.showHardReload ? " If this persists, hard-reload (Ctrl+Shift+R)." : ""));
        setViewStep("error");
        setStepMessage(mapped.title);
      }
    }
  };

  /**
   * Step 1: Pay (0.005 STT)
   */
  const handlePay = async () => {
    if (!somniaAddress || !payPerViewAddress) return;
    if (preflightIssues.length > 0) {
      setViewStep("error");
      setStepMessage("Blocked by pre-flight checks");
      setErrorMessage(preflightIssues.join(" | "));
      setErrorAction("Resolve the pre-flight issues first, then retry payment.");
      return;
    }

    if (!hasEnoughBalance) {
      const mapped = SOMNIA_PAY_ERRORS.insufficient_balance;
      setViewStep("error");
      setStepMessage(mapped.title);
      setErrorMessage(mapped.body);
      setErrorAction(mapped.action);
      addEvent("Payment failed: insufficient balance");
      return;
    }

    if (onWrongNetwork) {
      setViewStep("error");
      setStepMessage("Wrong network");
      setErrorMessage("Please switch to Somnia network first");
      return;
    }

    try {
      setViewStep("paying");
      setStepMessage("Confirm payment in your wallet");
      setErrorMessage("");
      setErrorAction("");
      addEvent("User initiated payment");

      const result = await callPayForVideo(
        videoId,
        balanceData?.value ?? 0n,
        (txHash) => {
          setLastSomniaTxHash(txHash);
          setViewStep("tx-pending");
          setStepMessage("Waiting for payment confirmation...");
          addEvent(`Payment tx sent: ${txHash.slice(0, 16)}...`);
        }
      );

      if (result.txHash) {
        setLastSomniaTxHash(result.txHash);
      }

      if (result.tokenId > 0n) {
        const mintedTokenId = result.tokenId.toString();
        setTokenId(mintedTokenId);
        setViewStep("minting");
        setStepMessage("NFT minted! Proceeding to Aleo proof generation...");
        addEvent(`AccessNFT minted from payment: token ${mintedTokenId}`);
      } else {
        setViewStep("minting");
        setStepMessage("Payment confirmed. Resolving minted access token...");
      }
    } catch (err) {
      const code = err instanceof SomniaPayError ? err.code : "unknown";
      const mapped = SOMNIA_PAY_ERRORS[code];
      setViewStep("error");
      setStepMessage(mapped.title);
      setErrorMessage(mapped.body);
      setErrorAction(mapped.action + (mapped.showHardReload ? " If this persists, hard-reload (Ctrl+Shift+R)." : ""));
      addEvent(`Payment failed (${code}): ${mapped.title}`);
    }
  };

  /**
   * Step 2: Grant View Token (Aleo)
   */
  const handleGenerateALeoProof = async () => {
    if (!aleoAddress || !tokenId) return;

    try {
      setViewStep("proving");
      setStepMessage("Generating Aleo proof in your wallet...");
      setErrorMessage("");
      setErrorAction("");
      addEvent("Starting Aleo proof generation");

      if (typeof requestExecution !== "function" && typeof requestTransaction !== "function") {
        throw new AleoProofError("sdk_unavailable", "Leo Wallet SDK execution methods are unavailable.");
      }

      const runGrantView = async () =>
        grantViewExecution({
          publicKey: aleoAddress,
          programId: aleoProgramId,
          videoId,
          tokenId,
          requestExecution,
          requestTransaction,
        });

      const { transactionId } = await runGrantView();

      setLastAleoProofId(transactionId.slice(0, 32));
      addEvent(`Aleo proof generated tx: ${transactionId.slice(0, 16)}...`);

      // Step 3: Call backend verify-and-serve
      await handleVerifyAndServe(transactionId);
    } catch (err: unknown) {
      const proofError = classifyProofError(err);

      // On proven permission/auth failure, refresh wallet authorization state for next retry.
      if (proofError.code === "execution_failed") {
        addEvent("Proof permission/auth failed. Refreshing Leo authorization state.");
        try {
          disconnectAleo();
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 400);
          });
          await connectAleo();
          addEvent("Leo authorization refreshed. User can retry proof.");
        } catch (reAuthErr) {
          const reAuthMessage = reAuthErr instanceof Error ? reAuthErr.message : String(reAuthErr ?? "unknown");
          addEvent(`Leo reauthorization failed: ${reAuthMessage}`);
        }
      }

      const mapped = ALEO_PROOF_ERRORS[proofError.code];
      setViewStep("error");
      setStepMessage(`Proof generation step failed - payment was received`);
      setErrorMessage(`${mapped.title}. ${mapped.body}`);
      setErrorAction(mapped.action + (mapped.showHardReload ? " If this persists, hard-reload (Ctrl+Shift+R)." : ""));
      addEvent(`Aleo proof failed (${proofError.code}): ${proofError.message}`);
      return;
    }
  };

  /**
   * Step 3: Backend Verification & Decryption Key Serve
   */
  const handleVerifyAndServe = async (viewTokenRecord: string) => {
    if (!somniaAddress) return;

    try {
      setViewStep("verifying");
      setStepMessage("Verifying access on server...");
      addEvent("Calling /api/verify-and-serve");

      const res = await fetch("/api/verify-and-serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          viewerAddress: somniaAddress,
          consumedAleoRecord: viewTokenRecord,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || `Backend error: ${res.status} ${res.statusText}`);
      }

      const { decryptionKey, videoId: serverVideoId } = (await res.json()) as {
        decryptionKey: string;
        videoId: string;
      };

      addEvent(`Server served decryption key for video ${serverVideoId}`);

      // Step 4: Decrypt
      await handleDecrypt(decryptionKey);
    } catch (err) {
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
      setErrorAction("Retry after verifying backend health and wallet connectivity.");
      addEvent(`Backend verify failed: ${classified.message}`);
    }
  };

  /**
   * Step 4: Client-side Decryption
   */
  const handleDecrypt = async (hexKey: string) => {
    try {
      setViewStep("consuming");
      setStepMessage("Decrypting video content...");
      addEvent("Starting client-side decryption");

      const blobUrl = await decryptAndPlay(videoId.toString(), hexKey);
      setDecryptedUrl(blobUrl);

      setViewStep("playing");
      setStepMessage(`Access Granted! Video ready to play.`);
      addEvent("Video decrypted and ready");
    } catch (err) {
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
      setErrorAction("Retry decryption. If the issue persists, contact support.");
      addEvent(`Decryption failed: ${classified.message}`);
    }
  };

  // Main UI
  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{video?.title || `Video ${videoId}`}</h1>
        <p className="text-gray-600">{video?.description || "Encrypted pay-per-view content"}</p>
      </div>

      {/* Progress Banner */}
      <div className="mb-6">
        <PopupBanner
          viewStep={viewStep}
          message={stepMessage}
          txHash={lastSomniaTxHash}
          error={errorMessage}
          action={errorAction}
          explorerUrl={explorerUrl}
        />
      </div>

      {/* Video Preview / Playback */}
      {decryptedUrl ? (
        <div className="mb-6 rounded-lg overflow-hidden bg-black">
          <video
            src={decryptedUrl}
            controls
            className="w-full"
            onCanPlay={() => addEvent("Video playing")}
          />
        </div>
      ) : (
        <div className="mb-6 rounded-lg bg-gray-200 h-64 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-lg font-semibold">Locked Content</p>
            <p className="text-sm text-gray-600 mt-1">Pay once to unlock fullscreen playback.</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Access Flow</CardTitle>
          <CardDescription>
            {preflightIssues.length > 0
              ? "Resolve pre-flight issues before connecting wallets or paying."
              : bothConnected
              ? `Wallets connected. Ready to purchase.`
              : walletReadyError
                ? walletReadyError
                : "Connect your wallets to proceed"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {preflightIssues.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Blocking Issues</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {preflightIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 0: Connect Wallets */}
          {!bothConnected && (
            <Button onClick={handleConnectWallets} className="w-full" disabled={preflightIssues.length > 0}>
              {walletReadyError ? "Fix Wallet" : "Connect Wallets"}
            </Button>
          )}

          {/* Step 1: Pay */}
          {bothConnected && !tokenId && preflightIssues.length === 0 && (
            <div className="space-y-2">
              {balanceData && (
                <p className="text-sm text-gray-600">
                  Balance: {parseFloat(balanceData.formatted).toFixed(4)} {balanceData.symbol}
                </p>
              )}
              <Button
                onClick={handlePay}
                disabled={!hasEnoughBalance || viewStep !== "idle"}
                className="w-full"
              >
                {viewStep === "idle" ? "Pay 0.005 STT" : "Processing..."}
              </Button>
            </div>
          )}

          {/* Step 2: Aleo Proof */}
          {tokenId && viewStep === "minting" && (
            <Button onClick={handleGenerateALeoProof} className="w-full">
              Generate Aleo Proof
            </Button>
          )}

          {/* Success */}
          {viewStep === "playing" && (
            <div className="p-3 bg-green-100 border border-green-300 rounded text-center">
              <p className="font-bold text-green-700">✓ Access Granted</p>
            </div>
          )}

          {/* Error Recovery */}
          {viewStep === "error" && (
            <Button onClick={() => setViewStep("idle")} variant="outline" className="w-full">
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Debug Panel */}
      <DebugPanel
        viewStep={viewStep}
        somniaAddress={somniaAddress}
        somniaChainId={chainId}
        aleoAddress={aleoAddress}
        aleoConnected={aleoConnected}
        lastSomniaTxHash={lastSomniaTxHash}
        lastAleoProofId={lastAleoProofId}
        events={events}
      />
    </main>
  );
}
