"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { SOMNIA_CHAIN_ID } from "@/constants";
import { ALEO_ERRORS } from "@/lib/error-messages";
import { AleoConnectError, AleoConnectErrorCode, useAleoConnect, useLeoWalletStatus } from "@/lib/aleo-wallet";

/**
 * Dual-wallet state management for PPV:
 * - Somnia (MetaMask): Payment via PayPerView.pay(), burn via AccessNFT
 * - Aleo (Aleo SDK): View token issuance via grant_view, consumption via consume_view
 *
 * Invariant: Both must be connected before allowing payment flow.
 */

interface WalletStateContextValue {
  // Somnia EVM (via MetaMask + wagmi)
  somniaAddress?: string;
  somniaConnected: boolean;
  somniaOnWrongNetwork: boolean;
  somniaError?: string;

  // Aleo (via Aleo SDK)
  aleoAddress?: string;
  aleoConnected: boolean;
  aleoError?: string;

  // Combined readiness
  bothConnected: boolean;
  walletReadyError?: string;

  // Wallet connection helpers
  connectAleo: (preferredWalletId?: string) => Promise<void>;
  disconnectAleo: () => void;
  switchToSomnia: () => Promise<void>;

  // Event log for debug panel
  addEvent: (message: string) => void;
  events: { timestamp: number; message: string }[];
}

const WalletStateContext = createContext<WalletStateContextValue | undefined>(undefined);

export function WalletStateProvider({ children }: { children: React.ReactNode }) {
  // Somnia state (via wagmi hooks)
  const { address: somniaAddress, isConnected: somniaConnected, chainId: somniaChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // Aleo state (manual management)
  const [aleoAddress, setAleoAddress] = useState<string | undefined>(undefined);
  const [aleoConnected, setAleoConnected] = useState(false);
  const [aleoError, setAleoError] = useState<string | undefined>(undefined);
  const {
    connectAleo: connectAleoAdapter,
    disconnectAleo: disconnectAleoAdapter,
    connected: adapterConnected,
    address: adapterAddress,
  } = useAleoConnect();

  // Event log (for DebugPanel)
  const [events, setEvents] = useState<{ timestamp: number; message: string }[]>([]);

  // Check if Somnia is on correct network (SOMNIA_CHAIN_ID = 102)
  const somniaOnWrongNetwork = somniaConnected && somniaChainId !== SOMNIA_CHAIN_ID;
  const somniaError = somniaOnWrongNetwork ? `Switch to Somnia network (Chain ${SOMNIA_CHAIN_ID})` : undefined;

  const addEvent = useCallback((message: string) => {
    setEvents((prev) => [...prev, { timestamp: Date.now(), message }]);
  }, []);

  const handleAleoDisconnect = useCallback(() => {
    setAleoAddress(undefined);
    setAleoConnected(false);
    setAleoError("Leo Wallet disconnected. Please reconnect.");
    addEvent("Leo Wallet disconnected mid-session");
  }, [addEvent]);

  useLeoWalletStatus(() => {
    if (aleoConnected) {
      handleAleoDisconnect();
    }
  });

  /**
   * connectAleo()
   * Connects to Aleo SDK via window.aleo_appName.
   * User must have Aleo wallet browser extension installed.
   */
  const connectAleo = useCallback(async (preferredWalletId?: string) => {
    void preferredWalletId;

    try {
      addEvent("Connecting Aleo wallet...");
      const { address, network } = await connectAleoAdapter();
      setAleoAddress(address);
      setAleoConnected(true);
      setAleoError(undefined);
      addEvent(`Aleo connected (${network}): ${address.slice(0, 10)}...`);
    } catch (err) {
      let code: AleoConnectErrorCode = "unknown";
      let message = "Unable to connect Leo wallet.";

      if (err instanceof AleoConnectError) {
        code = err.code;
        message = err.message;
      }

      const meta = ALEO_ERRORS[code];
      const userMessage =
        `${meta.title}. ${meta.body} Action: ${meta.action}` +
        (meta.showHardReload ? " If this persists, hard-reload the page (Ctrl+Shift+R)." : "");

      setAleoError(userMessage);
      addEvent(`Aleo error (${code}): ${message}`);
      throw new AleoConnectError(code, userMessage);
    }
  }, [addEvent, connectAleoAdapter]);

  /**
   * disconnectAleo()
   * Manually disconnect from Aleo wallet.
   */
  const disconnectAleo = useCallback(() => {
    void disconnectAleoAdapter().catch(() => {
      // Local state still gets cleared even if adapter disconnect fails.
    });
    setAleoAddress(undefined);
    setAleoConnected(false);
    setAleoError(undefined);
    addEvent("Aleo disconnected");
  }, [addEvent, disconnectAleoAdapter]);

  /**
   * switchToSomnia()
   * Prompt user to switch network to Somnia (Chain 102).
   */
  const switchToSomnia = useCallback(async () => {
    try {
      addEvent("Switching to Somnia network...");
      await switchChainAsync({ chainId: SOMNIA_CHAIN_ID });
      addEvent(`Switched to Somnia (Chain ${SOMNIA_CHAIN_ID})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network switch failed";
      addEvent(`Network switch error: ${msg}`);
      throw err;
    }
  }, [switchChainAsync, addEvent]);

  // Computed state
  const bothConnected = somniaConnected && aleoConnected && !somniaOnWrongNetwork;
  const walletReadyError = somniaOnWrongNetwork
    ? `Wrong network: Switch to Somnia (Chain ${SOMNIA_CHAIN_ID})`
    : !somniaConnected
      ? "EVM wallet not connected"
      : !aleoConnected
        ? aleoError || "Aleo wallet not connected"
        : undefined;

  React.useEffect(() => {
    if (adapterConnected && adapterAddress) {
      setAleoAddress(adapterAddress);
      setAleoConnected(true);
      setAleoError(undefined);
      if (typeof window !== "undefined") {
        (window as Window & { __aleoPublicKey?: string }).__aleoPublicKey = adapterAddress;
      }
    }
  }, [adapterConnected, adapterAddress]);

  const value = useMemo(
    () => ({
      somniaAddress,
      somniaConnected,
      somniaOnWrongNetwork,
      somniaError,
      aleoAddress,
      aleoConnected,
      aleoError,
      bothConnected,
      walletReadyError,
      connectAleo,
      disconnectAleo,
      switchToSomnia,
      addEvent,
      events,
    }),
    [
      somniaAddress,
      somniaConnected,
      somniaOnWrongNetwork,
      somniaError,
      aleoAddress,
      aleoConnected,
      aleoError,
      bothConnected,
      walletReadyError,
      connectAleo,
      disconnectAleo,
      switchToSomnia,
      addEvent,
      events,
    ]
  );

  return <WalletStateContext.Provider value={value}>{children}</WalletStateContext.Provider>;
}

export function useWalletState() {
  const ctx = useContext(WalletStateContext);
  if (!ctx) {
    throw new Error("useWalletState must be used within WalletStateProvider");
  }
  return ctx;
}
