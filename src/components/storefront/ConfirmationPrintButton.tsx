"use client";

import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ConfirmationPrintButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("min-h-11", className)}
      onClick={() => window.print()}
    >
      <Printer className="size-5 stroke-[1.5]" aria-hidden="true" />
      <span>Print Receipt</span>
    </Button>
  );
}
