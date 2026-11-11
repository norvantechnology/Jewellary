"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmationPrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden="true" />
      <span>Print Receipt</span>
    </Button>
  );
}
