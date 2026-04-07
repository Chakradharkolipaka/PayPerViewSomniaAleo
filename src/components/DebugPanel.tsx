/**
 * src/components/DebugPanel.tsx
 * Hidden debug panel for development/troubleshooting (renders only if NEXT_PUBLIC_DEBUG=true).
 *
 * Displays:
 * - Current ViewStep (idle → connecting → paying → ... → playing/error)
 * - Somnia address + network
 * - Aleo address + connected status
 * - Last Somnia tx hash (clickable explorer link)
 * - Last Aleo proof snippet (first 32 chars)
 * - Wallet event log (last 10 events)
 *
 * Props: Receives ViewStep state + tx data from parent page component.
 */

import React from "react";

export interface DebugPanelProps {
  viewStep: string;
  somniaAddress?: string;
  somniaChainId?: number;
  aleoAddress?: string;
  aleoConnected?: boolean;
  lastSomniaTxHash?: string;
  lastAleoProofId?: string;
  events?: { timestamp: number; message: string }[];
}

export function DebugPanel({
  viewStep,
  somniaAddress,
  somniaChainId,
  aleoAddress,
  aleoConnected,
  lastSomniaTxHash,
  lastAleoProofId,
  events = [],
}: DebugPanelProps) {
  // Only render if NEXT_PUBLIC_DEBUG is set
  if (process.env.NEXT_PUBLIC_DEBUG !== "true") {
    return null;
  }

  const explorerUrl = somniaChainId
    ? `https://explorer.somnia.network/tx/${lastSomniaTxHash}`
    : undefined;

  return (
    <div className="fixed bottom-20 right-4 w-80 bg-slate-900 text-white text-xs p-3 rounded border border-cyan-500 max-h-96 overflow-y-auto font-mono shadow-lg">
      {/* Title */}
      <div className="font-bold text-cyan-400 mb-2 sticky top-0 bg-slate-900">
        🐛 DEBUG PANEL
      </div>

      {/* ViewStep */}
      <div className="mb-2">
        <span className="text-gray-400">ViewStep:</span>
        <div className="text-green-400 font-bold">{viewStep}</div>
      </div>

      {/* Somnia */}
      <div className="mb-2 border-t border-gray-700 pt-2">
        <span className="text-gray-400">Somnia:</span>
        <div className="text-blue-300">
          {somniaAddress ? somniaAddress.slice(0, 8) + "..." : "—"}
        </div>
        <div className="text-gray-500">Chain: {somniaChainId || "—"}</div>
      </div>

      {/* Aleo */}
      <div className="mb-2 border-t border-gray-700 pt-2">
        <span className="text-gray-400">Aleo:</span>
        <div className="text-purple-300">
          {aleoAddress ? aleoAddress.slice(0, 15) + "..." : "—"}
        </div>
        <div className={`text-sm ${aleoConnected ? "text-green-400" : "text-red-400"}`}>
          {aleoConnected ? "✓ Connected" : "✗ Not connected"}
        </div>
      </div>

      {/* Last Somnia Tx */}
      {lastSomniaTxHash && (
        <div className="mb-2 border-t border-gray-700 pt-2">
          <span className="text-gray-400">Somnia Tx:</span>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline break-all"
            >
              {lastSomniaTxHash.slice(0, 12)}...
            </a>
          ) : (
            <div className="text-yellow-300 break-all">{lastSomniaTxHash.slice(0, 12)}...</div>
          )}
        </div>
      )}

      {/* Last Aleo Proof */}
      {lastAleoProofId && (
        <div className="mb-2 border-t border-gray-700 pt-2">
          <span className="text-gray-400">Aleo Proof:</span>
          <div className="text-purple-300 break-all">{lastAleoProofId.slice(0, 32)}...</div>
        </div>
      )}

      {/* Event Log */}
      {events.length > 0 && (
        <div className="border-t border-gray-700 pt-2">
          <span className="text-gray-400 block mb-1">Events (last 10):</span>
          <div className="space-y-1">
            {events.slice(-10).map((evt, idx) => (
              <div key={idx} className="text-gray-400 text-xs">
                <span className="text-gray-600">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                {" "}
                <span className="text-cyan-300">{evt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
