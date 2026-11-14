"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

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
  const ui = useUiText();
  const { formatPrice } = useCurrency();
  const isEdit = mode === "edit" && Boolean(requestNumber);
  const titleText = isEdit
    ? fill(ui.customize.header.editTitle, { number: requestNumber ?? "" })
    : ui.customize.header.title;
  const priceText = fill(ui.customize.header.fromPrice, { price: formatPrice(basePriceBase) });

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
                      aria-label={ui.customize.header.openFullPage}
                      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{ui.customize.header.openFullPage}</TooltipContent>
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
                      aria-label={ui.customize.sheet.closeAria}
                      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{ui.customize.sheet.close}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  const pageTitleText = isEdit
    ? fill(ui.customize.header.editTitle, { number: requestNumber ?? "" })
    : fill(ui.customize.header.productTitle, { name: productName });

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
            {fill(ui.customize.header.fromPrice, { price: formatPrice(basePriceBase) })}
          </p>
        </div>
      </div>

      {showHelper ? (
        <p className="text-sm text-muted-foreground">{ui.customize.header.subtitle}</p>
      ) : null}
    </div>
  );
}
