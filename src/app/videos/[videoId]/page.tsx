"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayPerViewModal } from "@/components/PayPerViewModal";
import { getAddress } from "viem";
import { payPerViewAbi, payPerViewAddress } from "@/constants";
import { connectLeoWallet, generateAleoProofForVideo } from "@/lib/aleo-wallet";
import { relayProofToVerulink } from "@/lib/verulink";
import { useWalletState } from "@/context/wallet-state";

export default function VideoWatchPage({ params }: { params: { videoId: string } }) {
  const videoId = Number(params.videoId);
  const { address, isConnected } = useAccount();
  const { leoAddress, setLeoAddress, setAccessExpiry } = useWalletState();

  const [showPayModal, setShowPayModal] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [zkLoading, setZkLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const { data: priceWei, refetch: refetchPrice } = useReadContract({
    address: payPerViewAddress,
    abi: payPerViewAbi,
    functionName: "videoPrice",
    args: [BigInt(videoId)],
    query: { enabled: Boolean(payPerViewAddress) && Number.isFinite(videoId) },
  });

  const { data: hasActiveAccess, refetch: refetchAccess, isLoading: checkingAccess } = useReadContract({
    address: payPerViewAddress,
    abi: payPerViewAbi,
    functionName: "hasActiveAccess",
    args: [address ? getAddress(address) : ("0x0000000000000000000000000000000000000000" as `0x${string}`), BigInt(videoId)],
    query: { enabled: Boolean(payPerViewAddress && address && Number.isFinite(videoId)) },
  });

  const { data: paymentHash, writeContract, isPending: paying } = useWriteContract();

  const { isSuccess: paymentConfirmed } = useWaitForTransactionReceipt({ hash: paymentHash });

  useEffect(() => {
    refetchPrice();
  }, [videoId, refetchPrice]);

  useEffect(() => {
    if (paymentConfirmed) {
      setStatus("Payment confirmed. Waiting for access activation...");
      refetchAccess();
    }
  }, [paymentConfirmed, refetchAccess]);

  const payable = useMemo(() => (typeof priceWei === "bigint" ? priceWei : 0n), [priceWei]);

  async function handlePay() {
    if (!payPerViewAddress || !address) return;

    writeContract({
      address: payPerViewAddress,
      abi: payPerViewAbi,
      functionName: "payForVideo",
      args: [BigInt(videoId)],
      value: payable,
    });
  }

  async function handleProofAndStream() {
    if (!address) return;

    setZkLoading(true);
    setStatus("Connecting Leo wallet...");

    try {
      const connectedLeoAddress = leoAddress || (await connectLeoWallet());
      setLeoAddress(connectedLeoAddress);

      setStatus("Generating Aleo proof in browser wallet...");
      const proof = await generateAleoProofForVideo(videoId);

      setStatus("Relaying proof to Somnia via Verulink...");
      await relayProofToVerulink({
        proof: proof.proofBytes,
        videoId,
        viewer: getAddress(address),
      });

      setStatus("Proof relayed. Waiting for AccessGranted...");

      let responseOk = false;
      for (let i = 0; i < 8; i++) {
        const resp = await fetch(`/api/stream?videoId=${videoId}&viewer=${address}`);
        if (resp.ok) {
          const body = await resp.json();
          setStreamUrl(body.signedUrl);
          setAccessExpiry(String(videoId), body.expiresAt);
          responseOk = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!responseOk) {
        throw new Error("Access not granted yet. Retry in a few seconds.");
      }

      setStatus("Access granted. Streaming unlocked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proof/stream flow failed");
    } finally {
      setZkLoading(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Video #{videoId}</CardTitle>
          <CardDescription>
            30-day rental access with STT on Somnia + private proof from Aleo via Verulink.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isConnected && <p className="text-sm text-muted-foreground">Connect MetaMask to continue.</p>}

          {isConnected && !checkingAccess && !hasActiveAccess && (
            <Button onClick={() => setShowPayModal(true)} disabled={!payPerViewAddress || payable <= 0n || paying}>
              Rent Access
            </Button>
          )}

          {isConnected && Boolean(hasActiveAccess) && (
            <Button onClick={handleProofAndStream} disabled={zkLoading}>
              {zkLoading ? "Generating proof..." : "Generate ZK Proof & Start Stream"}
            </Button>
          )}

          {status && <p className="text-sm text-muted-foreground">{status}</p>}

          {streamUrl && (
            <div className="rounded-xl border overflow-hidden">
              <iframe
                title={`video-${videoId}`}
                src={streamUrl}
                className="w-full aspect-video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </CardContent>
      </Card>

      <PayPerViewModal
        open={showPayModal}
        onOpenChange={setShowPayModal}
        onPay={handlePay}
        priceWei={payable}
        processing={paying}
      />
    </main>
  );
}
