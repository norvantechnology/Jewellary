"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button } from "@/components/ui/button";

interface CopyOrderNumberButtonProps {
  orderNumber: string;
}

/** One-tap button to copy the order reference number on order confirmation screens. */
export function CopyOrderNumberButton({ orderNumber }: CopyOrderNumberButtonProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      void notifySuccess(`Copied ${orderNumber}`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      void notifyError("Unable to copy automatically — please copy the order number manually.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void handleCopy()}
      aria-label={`Copy order number ${orderNumber}`}
      className="min-h-11 min-w-11 shrink-0 gap-1.5 px-2 text-muted-foreground sm:px-3"
    >
      {copied ? (
        <Check className="size-4 stroke-[1.5] text-success" aria-hidden="true" />
      ) : (
        <Copy className="size-4 stroke-[1.5]" aria-hidden="true" />
      )}
      <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
