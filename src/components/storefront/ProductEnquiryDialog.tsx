"use client";

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
  const isConciergeAdvice = priceMode === "FIXED" && availableStock > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isConciergeAdvice
              ? "Private Concierge"
              : priceMode === "PRICE_ON_REQUEST"
                ? "High Jewellery Consultation"
                : "Bespoke Commission Enquiry"}
          </DialogTitle>
          <DialogDescription>
            {isConciergeAdvice
              ? "Ask a gemologist about stone certificates, custom metal finishes, or sizing."
              : "Receive personalised stone specifications, studio imagery, and availability directly from our private client team."}
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
