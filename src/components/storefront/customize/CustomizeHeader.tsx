"use client";

import * as React from "react";
import Image from "next/image";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomizeHeaderProps {
  productName: string;
  productImageUrl: string | null;
  basePriceBase: string;
  variant: "page" | "drawer";
  mode?: "create" | "edit";
  requestNumber?: string;
  showHelper?: boolean;
  onOpenFullPage?: () => void;
  onClose?: () => void;
}

export function CustomizeHeader({
  productName,
  productImageUrl,
  basePriceBase,
  variant,
  mode = "create",
  requestNumber,
  showHelper = true,
  onOpenFullPage,
  onClose,
}: CustomizeHeaderProps) {
  const { formatPrice } = useCurrency();
  const isEdit = mode === "edit" && Boolean(requestNumber);
  const titleText = isEdit ? `Edit ${requestNumber}` : "Customize";
  const priceText = `From ${formatPrice(basePriceBase)}`;

  if (variant === "drawer") {
    return (
      <header className="customize-drawer-header shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="customize-drawer-thumb relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {productImageUrl ? (
                <Image
                  src={productImageUrl}
                  alt={productName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Sparkles className="size-4" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2
                title={titleText}
                className="truncate font-sans text-base leading-[1.2] font-semibold tracking-tight text-foreground sm:text-[17px] sm:leading-[1.25]"
              >
                {titleText}
              </h2>
              <div className="flex min-w-0 flex-col min-[480px]:flex-row min-[480px]:items-baseline min-[480px]:gap-1.5">
                <span
                  title={productName}
                  className="truncate text-sm leading-[1.2] text-muted-foreground"
                >
                  {productName}
                </span>
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 text-[13px] text-muted-foreground/60 min-[480px]:inline"
                >
                  ·
                </span>
                <span className="tabular-nums-price shrink-0 text-[13px] leading-[1.2] text-muted-foreground">
                  {priceText}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {onOpenFullPage ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onOpenFullPage}
                      aria-label="Open full page"
                      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open full page</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}

            {onClose ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      aria-label="Close customization drawer"
                      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  const pageTitleText = isEdit ? `Edit ${requestNumber}` : `Customize ${productName}`;

  return (
    <div className="space-y-2 border-b border-border pb-5">
      <div className="flex items-center gap-3.5">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt={productName}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1
            title={pageTitleText}
            className="truncate font-sans text-[clamp(24px,3vw,32px)] leading-tight font-semibold tracking-[-0.02em] text-foreground"
          >
            {pageTitleText}
          </h1>
          <p className="tabular-nums-price text-sm text-muted-foreground">
            From {formatPrice(basePriceBase)}
          </p>
        </div>
      </div>

      {showHelper ? (
        <p className="text-sm text-muted-foreground">
          Choose your options and we&apos;ll send a quote within 24 hours.
        </p>
      ) : null}
    </div>
  );
}
