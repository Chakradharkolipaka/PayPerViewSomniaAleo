"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type AccessExpiryMap = Record<string, number>;

interface WalletStateContextValue {
  leoAddress?: string;
  setLeoAddress: (address?: string) => void;
  accessExpiryMap: AccessExpiryMap;
  setAccessExpiry: (videoId: string, expiry: number) => void;
  clearAccessState: () => void;
}

const WalletStateContext = createContext<WalletStateContextValue | undefined>(undefined);

export function WalletStateProvider({ children }: { children: React.ReactNode }) {
  const [leoAddress, setLeoAddressState] = useState<string | undefined>(undefined);
  const [accessExpiryMap, setAccessExpiryMap] = useState<AccessExpiryMap>({});

  const setLeoAddress = useCallback((address?: string) => {
    setLeoAddressState(address);
  }, []);

  const setAccessExpiry = useCallback((videoId: string, expiry: number) => {
    setAccessExpiryMap((prev) => ({ ...prev, [videoId]: expiry }));
  }, []);

  const clearAccessState = useCallback(() => {
    setAccessExpiryMap({});
  }, []);

  const value = useMemo(
    () => ({ leoAddress, setLeoAddress, accessExpiryMap, setAccessExpiry, clearAccessState }),
    [leoAddress, setLeoAddress, accessExpiryMap, setAccessExpiry, clearAccessState]
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
