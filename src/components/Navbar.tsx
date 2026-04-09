"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home, PlayCircle, Upload, KeyRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useWalletState } from "@/context/wallet-state";

export default function Navbar() {
  const pathname = usePathname();
  const { aleoConnected, aleoAddress, connectAleo, disconnectAleo } = useWalletState();

  const handleAleoToggle = async () => {
    if (aleoConnected) {
      disconnectAleo();
      return;
    }

    try {
      await connectAleo();
    } catch {
      // Keep silent here; watch/mint flows already render detailed status messages.
    }
  };

  return (
    <nav className="hidden md:flex sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background text-sm font-bold">
              PPV
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">Private Pay-Per-View</span>
              <span className="text-xs text-muted-foreground leading-tight">
                Aleo + Somnia one-time view access
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${
                pathname === "/" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/videos/1"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith("/videos") ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <PlayCircle className="h-4 w-4" />
              <span>Watch</span>
            </Link>
            <Link
              href="/mint"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith("/mint") ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>Mint</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleAleoToggle} className="rounded-full">
            <KeyRound className="mr-2 h-4 w-4" />
            {aleoConnected
              ? `Leo ${aleoAddress ? `${aleoAddress.slice(0, 6)}...${aleoAddress.slice(-4)}` : "Connected"}`
              : "Connect Leo"}
          </Button>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
