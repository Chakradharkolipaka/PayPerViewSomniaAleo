"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  useSwitchChain,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PopupBanner } from "@/components/PopupBanner";
import { DebugPanel } from "@/components/DebugPanel";
import { useWalletState } from "@/context/wallet-state";
import { getAddress } from "viem";
import {
  SOMNIA_CHAIN_ID,
  VIDEO_PRICE_WEI,
  payPerViewAddress,
  accessNftAddress,
  payPerViewAbi,
  accessNftAbi,
  BACKEND_URL,
} from "@/constants";
import { grantViewToken, consumeViewToken } from "@/lib/aleo-wallet";
import { decryptAndPlay } from "@/lib/decrypt";
import { PPV_ERRORS, classifyError } from "@/lib/ppv-errors";
import { useToast } from "@/components/ui/use-toast";

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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// Dummy video catalog for now (TODO: move to backend /api/videos endpoint)
const VIDEOS: Record<number, { title: string; durationSeconds: number; coverUrl: string }> = {
  1: {
    title: "Getting Started with Aleo",
    durationSeconds: 600,
    coverUrl: "https://via.placeholder.com/640x360?text=Video+1",
  },
  2: {
    title: "Advanced Aleo Proofs",
    durationSeconds: 1200,
    coverUrl: "https://via.placeholder.com/640x360?text=Video+2",
  },
};

export default function VideoWatchPage({ params }: { params: { videoId: string } }) {
  const videoId = Number(params.videoId);
  const video = VIDEOS[videoId] || { title: `Video ${videoId}`, durationSeconds: 0, coverUrl: "" };

  // Somnia wallet (via wagmi)
  const { address: somniaAddress, isConnected: somniaConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { toast } = useToast();

  // Aleo + Somnia state management
  const {
    aleoAddress,
    aleoConnected,
    bothConnected,
    walletReadyError,
    connectAleo,
    switchToSomnia,
    addEvent,
    events,
  } = useWalletState();

  // State machine
  const [viewStep, setViewStep] = useState<ViewStep>("idle");
  const [stepMessage, setStepMessage] = useState<string>("Ready to purchase access");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastSomniaTxHash, setLastSomniaTxHash] = useState<string>("");
  const [lastAleoProofId, setLastAleoProofId] = useState<string>("");
  const [tokenId, setTokenId] = useState<string>("");
  const [decryptedUrl, setDecryptedUrl] = useState<string>("");

  // Somnia contract interactions
  const { data: balanceData } = useBalance({ address: somniaAddress });
  const { writeContractAsync: payAsync } = useWriteContract();
  const { data: payTxData, isLoading: payPending } = useWaitForTransactionReceipt({
    hash: lastSomniaTxHash ? (lastSomniaTxHash as `0x${string}`) : undefined,
  });

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
        const classified = classifyError(err);
        setErrorMessage(classified.message);
        setViewStep("error");
        setStepMessage(classified.message);
      }
    }
  };

  /**
   * Step 1: Pay (0.005 STT)
   */
  const handlePay = async () => {
    if (!somniaAddress || !payPerViewAddress) return;

    if (!hasEnoughBalance) {
      const err = new Error("Insufficient balance");
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
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
      setStepMessage("Confirm payment in MetaMask");
      addEvent("User initiated payment");

      const hash = await payAsync({
        address: payPerViewAddress,
        abi: payPerViewAbi,
        functionName: "pay",
        args: [BigInt(videoId)],
        value: VIDEO_PRICE_WEI,
      });

      if (hash) {
        setLastSomniaTxHash(hash);
        setViewStep("tx-pending");
        setStepMessage("Waiting for payment confirmation...");
        addEvent(`Payment tx sent: ${hash.slice(0, 16)}...`);
      }
    } catch (err) {
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
      addEvent(`Payment failed: ${classified.message}`);
    }
  };

  // Monitor payment confirmation
  useEffect(() => {
    if (payTxData?.transactionHash && !tokenId) {
      setViewStep("minting");
      setStepMessage("NFT minted! Proceeding to Aleo proof generation...");
      addEvent("AccessNFT minted from payment");
      
      // TODO: Parse PaymentReceived event to get tokenId
      // For now, assume tokenId 1
      setTokenId("1");
    }
  }, [payTxData, tokenId]);

  /**
   * Step 2: Grant View Token (Aleo)
   */
  const handleGenerateALeoProof = async () => {
    if (!aleoAddress || !tokenId) return;

    try {
      setViewStep("proving");
      setStepMessage("Generating Aleo proof in your wallet...");
      addEvent("Starting Aleo proof generation");

      const programId = process.env.NEXT_PUBLIC_ALEO_PROGRAM_ID || "video_access_testnet";
      const viewTokenRecord = await grantViewToken(
        programId,
        aleoAddress,
        videoId,
        BigInt(tokenId)
      );

      setLastAleoProofId(viewTokenRecord.slice(0, 32));
      addEvent(`Aleo proof generated: ${viewTokenRecord.slice(0, 16)}...`);

      // Step 3: Call backend verify-and-serve
      await handleVerifyAndServe(viewTokenRecord);
    } catch (err) {
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
      addEvent(`Aleo proof failed: ${classified.message}`);
    }
  };

  /**
   * Step 3: Backend Verification & Decryption Key Serve
   */
  const handleVerifyAndServe = async (viewTokenRecord: string) => {
    if (!somniaAddress) return;

    try {
      setViewStep("verifying");
      setStepMessage("Verifying with backend...");
      addEvent("Calling backend verify-and-serve");

      const res = await fetch(`${BACKEND_URL}/api/verify-and-serve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          viewerAddress: somniaAddress,
          consumedAleoRecord: viewTokenRecord,
        }),
      });

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status} ${res.statusText}`);
      }

      const { decryptionKey, videoId: serverVideoId } = (await res.json()) as {
        decryptionKey: string;
        videoId: string;
      };

      addEvent(`Backend served decryption key for video ${serverVideoId}`);

      // Step 4: Decrypt
      await handleDecrypt(decryptionKey);
    } catch (err) {
      const classified = classifyError(err);
      setViewStep("error");
      setStepMessage(classified.message);
      setErrorMessage(classified.detailed);
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
      addEvent(`Decryption failed: ${classified.message}`);
    }
  };

  // Main UI
  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{video.title}</h1>
        <p className="text-gray-600">{video.durationSeconds} seconds • Video #{videoId}</p>
      </div>

      {/* Progress Banner */}
      <div className="mb-6">
        <PopupBanner
          viewStep={viewStep}
          message={stepMessage}
          txHash={lastSomniaTxHash}
          error={errorMessage}
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
          <img src={video.coverUrl} alt={video.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Access Flow</CardTitle>
          <CardDescription>
            {bothConnected
              ? `Wallets connected. Ready to purchase.`
              : walletReadyError
                ? walletReadyError
                : "Connect your wallets to proceed"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step 0: Connect Wallets */}
          {!bothConnected && (
            <Button onClick={handleConnectWallets} className="w-full">
              {walletReadyError ? "Fix Wallet" : "Connect Wallets"}
            </Button>
          )}

          {/* Step 1: Pay */}
          {bothConnected && !tokenId && (
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
