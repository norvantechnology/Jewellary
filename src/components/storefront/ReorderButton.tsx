"use client";

import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { reorderOrderAction } from "@/modules/account/account.actions";
import type { CartSummaryDTO } from "@/modules/cart/cart.service";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface ReorderButtonProps {
  orderNumber: string;
  guestToken?: string | null;
}

export function ReorderButton({ orderNumber, guestToken }: ReorderButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const handleReorder = async () => {
    setBusy(true);
    const res = await reorderOrderAction({
      orderNumber,
      guestToken: guestToken ?? null,
    });
    setBusy(false);

    if (!res.ok) {
      void notifyError(res.error.message);
      return;
    }

    const payload = res.data as {
      cart: CartSummaryDTO;
      addedCount: number;
      skippedItems: string[];
    };

    visitorStore.setLatestCart(payload.cart);
    visitorStore.openCartDrawer();

    if (payload.skippedItems.length > 0) {
      void notifySuccess(
        `Added ${payload.addedCount} available ${payload.addedCount === 1 ? "piece" : "pieces"} to your bag. Unavailable: ${payload.skippedItems.join(", ")}.`,
      );
      return;
    }

    void notifySuccess("Pieces from this order added to your bag.");
  };

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={busy}
      onClick={() => void handleReorder()}
      className="min-h-11 w-full gap-2 sm:min-h-10 sm:w-auto"
    >
      {busy ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCcw className="size-4 shrink-0 stroke-[1.5]" aria-hidden="true" />
      )}
      <span>{busy ? "Adding…" : "Reorder"}</span>
    </Button>
  );
}
