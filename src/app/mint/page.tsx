"use client";

import React, { FormEvent, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PopupBanner } from "@/components/PopupBanner";

type MintStep = "idle" | "connecting" | "tx-pending" | "minting" | "playing" | "error";

export default function MintPage() {
  const { address } = useAccount();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<MintStep>("idle");
  const [message, setMessage] = useState("Ready to mint a video.");
  const [error, setError] = useState("");
  const [createdVideoId, setCreatedVideoId] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

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
        | { error?: string; videoId?: number }
        | null;

      if (!res.ok) {
        throw new Error(payload?.error || `Upload failed (${res.status})`);
      }

      setStep("minting");
      setMessage("Video minted and published on the home page.");
      setCreatedVideoId(payload?.videoId ?? null);

      setStep("playing");
      setMessage("Mint complete. You can now open the watch page.");
    } catch (err) {
      setStep("error");
      setMessage("Mint failed.");
      setError(err instanceof Error ? err.message : "Unknown mint error");
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
            <Button type="submit" className="w-full">
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
