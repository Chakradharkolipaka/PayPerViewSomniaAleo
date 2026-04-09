"use client";

import { useCallback, useState } from "react";
import { connectLeoWallet, AleoConnectError, AleoConnectErrorCode } from "@/lib/aleo-wallet";
import { CONNECT_ERROR_MESSAGES } from "@/lib/aleo-connect-messages";
import { Button } from "@/components/ui/button";

type ConnectState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string; network: string }
  | { status: "error"; code: AleoConnectErrorCode; message: string };

export function ConnectAleoButton() {
  const [state, setState] = useState<ConnectState>({ status: "idle" });

  const handleConnect = useCallback(async () => {
    setState({ status: "connecting" });

    try {
      const { address, network } = await connectLeoWallet();
      setState({ status: "connected", address, network });
    } catch (err) {
      if (err instanceof AleoConnectError) {
        setState({ status: "error", code: err.code, message: err.message });
      } else {
        setState({ status: "error", code: "unknown", message: String(err) });
      }
    }
  }, []);

  if (state.status === "connected") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        Connected: {state.address.slice(0, 12)}...{state.address.slice(-6)}
        <span className="ml-2 text-green-600/80">{state.network}</span>
      </div>
    );
  }

  if (state.status === "error") {
    const meta = CONNECT_ERROR_MESSAGES[state.code];
    const actionText = meta.retryable
      ? `${meta.action} If this persists, please hard-reload the page (Ctrl+Shift+R).`
      : meta.action;

    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p className="font-semibold">{meta.title}</p>
        <p className="mt-1 text-xs text-red-700/90">{actionText}</p>
        {meta.retryable && (
          <Button onClick={handleConnect} className="mt-2 h-8 px-3 text-xs" variant="outline">
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} disabled={state.status === "connecting"}>
      {state.status === "connecting" ? "Connecting to Leo Wallet..." : "Connect Leo Wallet"}
    </Button>
  );
}
