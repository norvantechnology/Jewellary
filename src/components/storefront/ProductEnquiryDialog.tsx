"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { EnquiryForm } from "@/components/storefront/EnquiryForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductEnquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  availableStock: number;
}

export function ProductEnquiryDialog({
  open,
  onOpenChange,
  productId,
  productName,
  priceMode,
  availableStock,
}: ProductEnquiryDialogProps) {
  const ui = useUiText();
  const isConciergeAdvice = priceMode === "FIXED" && availableStock > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isConciergeAdvice
              ? ui.product.enquiry.conciergeTitle
              : priceMode === "PRICE_ON_REQUEST"
                ? ui.product.enquiry.consultationTitle
                : ui.product.enquiry.bespokeTitle}
          </DialogTitle>
          <DialogDescription>
            {isConciergeAdvice ? ui.product.enquiry.conciergeText : ui.product.enquiry.bespokeText}
          </DialogDescription>
        </DialogHeader>
        <EnquiryForm
          defaultType={isConciergeAdvice ? "PRODUCT" : "BESPOKE"}
          productId={productId}
          productName={productName}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
