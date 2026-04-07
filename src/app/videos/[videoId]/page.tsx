"use client";

import Image from "next/image";
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
import {
  SOMNIA_CHAIN_ID,
  VIDEO_PRICE_WEI,
  payPerViewAddress,
  accessNftAddress,
  payPerViewAbi,
  accessNftAbi,
} from "@/constants";
import { decodeEventLog } from "viem";
import { grantViewToken } from "@/lib/aleo-wallet";
import { decryptAndPlay } from "@/lib/decrypt";
import { classifyError } from "@/lib/ppv-errors";

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
  const [video, setVideo] = useState<VideoMeta | null>(null);

  // Somnia wallet (via wagmi)
  const { address: somniaAddress, isConnected: somniaConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

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
      }
    }

    loadVideoMeta();
  }, [videoId]);

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
      setStepMessage("Payment confirmed. Resolving minted access token...");

      for (const log of payTxData.logs) {
        try {
          const decoded = decodeEventLog({
            abi: payPerViewAbi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "AccessMinted") {
            const mintedTokenId = decoded.args.tokenId?.toString();
            if (mintedTokenId) {
              setTokenId(mintedTokenId);
              addEvent(`AccessNFT minted from payment: token ${mintedTokenId}`);
              setStepMessage("NFT minted! Proceeding to Aleo proof generation...");
              break;
            }
          }
        } catch {
          // ignore unrelated logs
        }
      }
    }
  }, [payTxData, tokenId, addEvent]);

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
