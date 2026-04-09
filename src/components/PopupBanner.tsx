/**
 * src/components/PopupBanner.tsx
 * Step-by-step status banner with color coding for the 4-step PPV flow.
 *
 * Props:
 *   viewStep: 'idle' | 'connecting' | 'paying' | 'tx-pending' | 'minting' | 'proving' | 'consuming' | 'verifying' | 'playing' | 'error'
 *   message: User-facing message string
 *   txHash: Optional Somnia tx hash for explorer link
 *   error: Optional error message (shows in red)
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

interface PopupBannerProps {
  viewStep: ViewStep;
  message: string;
  txHash?: string;
  error?: string;
  action?: string;
  explorerUrl?: string;
}

const STEP_COLORS: Record<ViewStep, string> = {
  idle: "bg-slate-50 border-slate-200",
  connecting: "bg-blue-50 border-blue-200",
  paying: "bg-amber-50 border-amber-200",
  "tx-pending": "bg-amber-50 border-amber-200",
  minting: "bg-purple-50 border-purple-200",
  proving: "bg-cyan-50 border-cyan-200",
  consuming: "bg-teal-50 border-teal-200",
  verifying: "bg-green-50 border-green-200",
  playing: "bg-green-100 border-green-300",
  error: "bg-red-50 border-red-200",
};

const STEP_ICONS: Record<ViewStep, string> = {
  idle: "⚪",
  connecting: "🔗",
  paying: "💳",
  "tx-pending": "⏳",
  minting: "🪙",
  proving: "🔐",
  consuming: "✅",
  verifying: "📋",
  playing: "▶️",
  error: "❌",
};

const STEP_LABELS: Record<ViewStep, string> = {
  idle: "Ready",
  connecting: "Connecting...",
  paying: "Processing Payment...",
  "tx-pending": "Awaiting Confirmation...",
  minting: "Minting NFT...",
  proving: "Generating Aleo Proof...",
  consuming: "Finalizing Access...",
  verifying: "Verifying with Backend...",
  playing: "Access Granted ✓",
  error: "Error",
};

export function PopupBanner({
  viewStep,
  message,
  txHash,
  error,
  action,
  explorerUrl,
}: PopupBannerProps) {
  const colorClass = STEP_COLORS[viewStep];
  const icon = STEP_ICONS[viewStep];
  const label = STEP_LABELS[viewStep];

  const txLink = txHash && explorerUrl ? `${explorerUrl}tx/${txHash}` : undefined;

  return (
    <Card className={`border-2 ${colorClass}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <CardTitle className="text-lg">{label}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
        </div>
      </CardHeader>

      {(error || action || txLink) && (
        <CardContent className="text-xs space-y-2">
          {error && <div className="text-red-600 font-mono">{error}</div>}
          {action && <div className="text-red-700 font-semibold">Action: {action}</div>}
          {txLink && (
            <a
              href={txLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-mono break-all"
            >
              {txHash?.slice(0, 16)}... (View on Explorer)
            </a>
          )}
        </CardContent>
      )}
    </Card>
  );
}
