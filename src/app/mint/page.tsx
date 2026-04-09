"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PopupBanner } from "@/components/PopupBanner";
import { useToast } from "@/components/ui/use-toast";

type MintStep = "idle" | "connecting" | "tx-pending" | "minting" | "playing" | "error";

type HealthResponse = {
  mintReadiness?: {
    environment?: string;
    ready?: boolean;
    reasons?: string[];
  };
};

type MintUploadResponse = {
  error?: string;
  code?: string;
  action?: string;
  videoId?: number;
};

export default function MintPage() {
  const { address } = useAccount();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<MintStep>("idle");
  const [message, setMessage] = useState("Ready to mint a video.");
  const [error, setError] = useState("");
  const [createdVideoId, setCreatedVideoId] = useState<number | null>(null);
  const [mintReady, setMintReady] = useState(true);
  const [mintReadinessMessage, setMintReadinessMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMintHealth() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const payload = (await res.json().catch(() => null)) as HealthResponse | null;
        const readiness = payload?.mintReadiness;

        if (cancelled || !readiness) {
          return;
        }

        const isReady = readiness.ready !== false;
        setMintReady(isReady);

        if (!isReady) {
          const reasons = readiness.reasons?.join(". ") || "Mint service is temporarily unavailable.";
          setMintReadinessMessage(reasons);
          setStep("error");
          setMessage("Minting is temporarily unavailable.");
          setError(reasons);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setMintReady(false);
        setMintReadinessMessage("Unable to verify backend health. Please try again in a moment.");
        setStep("error");
        setMessage("Minting status is unknown.");
        setError("Unable to verify backend health. Please refresh or contact support.");
      }
    }

    loadMintHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  function buildMintError(payload: MintUploadResponse | null, statusCode: number) {
    if (payload?.code === "BLOB_STORAGE_NOT_CONFIGURED") {
      return {
        heading: "Minting service is not configured in production.",
        details:
          payload.action ||
          "Set BLOB_READ_WRITE_TOKEN in Vercel environment variables and redeploy.",
      };
    }

    if (payload?.code === "MASTER_KEY_NOT_CONFIGURED") {
      return {
        heading: "Server encryption key is missing.",
        details: payload.action || "Set PPV_MASTER_KEY in environment variables and redeploy.",
      };
    }

    return {
      heading: "Mint failed.",
      details: payload?.error || `Upload failed (${statusCode})`,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!mintReady) {
      const unavailableMessage =
        mintReadinessMessage || "Minting is temporarily unavailable due to backend configuration.";
      setStep("error");
      setMessage("Minting is temporarily unavailable.");
      setError(unavailableMessage);
      toast({
        variant: "destructive",
        title: "Mint disabled",
        description: unavailableMessage,
      });
      return;
    }

    if (!address) {
      setStep("error");
      setMessage("Connect wallet first.");
      setError("Wallet is not connected.");
      return;
    }

    if (!title.trim() || !description.trim() || !file) {
      setStep("error");
      setMessage("Missing required fields.");
      setError("Title, description, and .mp4 file are required.");
      return;
    }

    const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
    if (!isMp4) {
      setStep("error");
      setMessage("Unsupported file format.");
      setError("Only .mp4 files are supported.");
      return;
    }

    try {
      setStep("tx-pending");
      setMessage("Uploading and encrypting .mp4...");

      const form = new FormData();
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("creator", address);
      form.append("file", file);

      const res = await fetch("/api/aleo-storage/upload", {
        method: "POST",
        body: form,
      });

      const payload = (await res.json().catch(() => null)) as
        | MintUploadResponse
        | null;

      if (!res.ok) {
        const formatted = buildMintError(payload, res.status);
        throw new Error(`${formatted.heading} ${formatted.details}`.trim());
      }

      setStep("minting");
      setMessage("Video minted and published on the home page.");
      setCreatedVideoId(payload?.videoId ?? null);

      setStep("playing");
      setMessage("Mint complete. You can now open the watch page.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown mint error";
      setStep("error");
      setMessage("Mint failed.");
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Mint failed",
        description: errorMessage,
      });
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Mint Video</h1>

      <PopupBanner viewStep={step} message={message} error={error} />

      <Card>
        <CardHeader>
          <CardTitle>Creator Upload</CardTitle>
          <CardDescription>Upload title, description, and one .mp4 file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="Video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="Video description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Input
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {!mintReady && (
              <p className="text-sm text-red-600" role="alert">
                Minting is disabled: {mintReadinessMessage}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={!mintReady}>
              Upload & Mint
            </Button>
          </form>

          {createdVideoId && (
            <p className="mt-4 text-sm text-green-700">Created video #{createdVideoId}. Open it from home.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
