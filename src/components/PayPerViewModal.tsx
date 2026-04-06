"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatEther } from "viem";

interface PayPerViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: () => Promise<void> | void;
  priceWei?: bigint;
  processing: boolean;
}

export function PayPerViewModal({ open, onOpenChange, onPay, priceWei, processing }: PayPerViewModalProps) {
  const priceLabel = priceWei ? `${formatEther(priceWei)} STT` : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rent this video for 30 days</DialogTitle>
          <DialogDescription>
            Payment is processed on Somnia using native STT. Refund is available for 24 hours only if access was not activated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rental price</span>
              <span className="font-semibold">{priceLabel}</span>
            </div>
          </div>

          <Button className="w-full" onClick={onPay} disabled={processing || !priceWei || priceWei <= 0n}>
            {processing ? "Processing payment..." : "Pay with STT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
