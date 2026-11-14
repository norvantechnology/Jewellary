"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Ruler,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Price } from "@/components/shared/Price";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { RingSizeGuideSheet } from "@/components/storefront/RingSizeGuideSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { openAtelierCustomization } from "@/lib/atelier-events";
import { cn } from "@/lib/utils";
import { addToCartAction } from "@/modules/cart/cart.actions";
import type { PublicCardVariantOptionDTO } from "@/modules/catalog/catalog.public";
import { visitorStore } from "@/modules/storefront/visitor-store";

export interface QuickSelectProductSummary {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  compareAtPrice: string | null;
  hasSizing: boolean;
  isCustomizable?: boolean;
  imageUrl: string | null;
  imageAltText: string | null;
  variants: PublicCardVariantOptionDTO[];
}

interface QuickSelectVariantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: QuickSelectProductSummary;
  initialVariantId?: string | null;
  onAdded?: (variantTitle: string) => void;
}

const rememberedVariantByProduct = new Map<string, string>();

function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function uniqueValues(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = item?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function formatSizePillLabel(rawSize: string): string {
  return rawSize.replace(/^Size\s+/i, "").trim() || rawSize;
}

interface AttributeGrouping {
  mode: "grouped" | "radio";
  sizes: string[];
  metals: string[];
  stoneSpecs: string[];
}

function analyzeVariantGrouping(
  variants: PublicCardVariantOptionDTO[],
  hasSizing: boolean,
): AttributeGrouping {
  const sizes = uniqueValues(variants.map((v) => v.size));
  const metals = uniqueValues(variants.map((v) => v.metal));
  const stoneSpecs = uniqueValues(variants.map((v) => v.stoneSpec));

  const tupleKeys = new Set(
    variants.map(
      (v) => `${v.size?.trim() ?? ""}||${v.metal?.trim() ?? ""}||${v.stoneSpec?.trim() ?? ""}`,
    ),
  );
  const hasUniqueTuples = tupleKeys.size === variants.length;
  const varyingAxes =
    (sizes.length >= 2 ? 1 : 0) + (metals.length >= 2 ? 1 : 0) + (stoneSpecs.length >= 2 ? 1 : 0);

  const useGrouped =
    hasUniqueTuples &&
    variants.length >= 2 &&
    ((sizes.length >= 1 && hasSizing) || sizes.length >= 2 || varyingAxes >= 2);

  return {
    mode: useGrouped ? "grouped" : "radio",
    sizes,
    metals,
    stoneSpecs,
  };
}

function findMatchingVariant(
  variants: PublicCardVariantOptionDTO[],
  target: { size?: string | null; metal?: string | null; stoneSpec?: string | null },
  preferInStock = true,
): PublicCardVariantOptionDTO | null {
  const exact = variants.find(
    (v) =>
      (target.size === undefined || (v.size?.trim() ?? null) === target.size) &&
      (target.metal === undefined || (v.metal?.trim() ?? null) === target.metal) &&
      (target.stoneSpec === undefined || (v.stoneSpec?.trim() ?? null) === target.stoneSpec),
  );
  if (exact && (!preferInStock || exact.availableStock > 0)) return exact;

  const fallbackPool = variants.filter((v) => {
    if (target.metal && (v.metal?.trim() ?? null) !== target.metal) return false;
    if (target.size && (v.size?.trim() ?? null) !== target.size && !exact) return false;
    return true;
  });

  if (fallbackPool.length > 0) {
    return fallbackPool.find((v) => v.availableStock > 0) ?? fallbackPool[0] ?? null;
  }

  return exact ?? null;
}

function formatStockLabel(
  stock: number,
  labels: { soldOutStock: string; leftStock: string; inStock: string },
): { text: string; tone: "muted" | "warning" | "sold" } {
  if (stock <= 0) return { text: labels.soldOutStock, tone: "sold" };
  if (stock <= 5) return { text: fill(labels.leftStock, { count: stock }), tone: "warning" };
  return { text: labels.inStock, tone: "muted" };
}

export function QuickSelectVariantModal({
  open,
  onOpenChange,
  product,
  initialVariantId,
  onAdded,
}: QuickSelectVariantModalProps) {
  const ui = useUiText();
  const router = useRouter();
  const isMobile = useIsMobileViewport();
  const { formatPrice } = useCurrency();
  const titleId = React.useId();

  const resolveInitialVariant = React.useCallback(() => {
    const rememberedId = rememberedVariantByProduct.get(product.id);
    if (rememberedId) {
      const remembered = product.variants.find((v) => v.id === rememberedId);
      if (remembered) return remembered;
    }
    if (initialVariantId) {
      const explicit = product.variants.find((v) => v.id === initialVariantId);
      if (explicit && explicit.availableStock > 0) return explicit;
    }
    return (
      product.variants.find((v) => v.isDefault && v.availableStock > 0) ??
      product.variants.find((v) => v.availableStock > 0) ??
      product.variants[0] ??
      null
    );
  }, [initialVariantId, product.id, product.variants]);

  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => resolveInitialVariant()?.id ?? null,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [busyMode, setBusyMode] = React.useState<"bag" | "buy" | null>(null);
  const [addedSuccess, setAddedSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [liveStatus, setLiveStatus] = React.useState("");
  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const nextInitial = resolveInitialVariant();
      setSelectedId(nextInitial?.id ?? null);
      setQuantity(1);
      setBusyMode(null);
      setAddedSuccess(false);
      setErrorMessage(null);
      setLiveStatus("");
    }
  }

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  const selectedVariant =
    product.variants.find((v) => v.id === selectedId) ?? resolveInitialVariant();

  const selectVariant = React.useCallback(
    (variantId: string) => {
      setSelectedId(variantId);
      rememberedVariantByProduct.set(product.id, variantId);
      setQuantity(1);
      setErrorMessage(null);
      setAddedSuccess(false);
    },
    [product.id],
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        setBusyMode(null);
        setAddedSuccess(false);
        setErrorMessage(null);
        setLiveStatus("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const grouping = React.useMemo(
    () => analyzeVariantGrouping(product.variants, product.hasSizing),
    [product.variants, product.hasSizing],
  );

  const availableStock = selectedVariant?.availableStock ?? 0;
  const maxQty = Math.min(10, Math.max(1, availableStock));
  const safeQty = Math.min(quantity, maxQty);
  const isAtMaxStock = availableStock > 0 && safeQty >= maxQty;
  const unitPriceNum = Number(selectedVariant?.price ?? product.basePrice);
  const basePriceNum = Number(product.basePrice);
  const lineTotalNum = Number.isFinite(unitPriceNum) ? unitPriceNum * safeQty : 0;

  async function submitCart(mode: "bag" | "buy") {
    if (!selectedVariant || availableStock <= 0 || product.priceMode !== "FIXED") return;

    setErrorMessage(null);
    setBusyMode(mode);
    const res = await addToCartAction({
      variantId: selectedVariant.id,
      quantity: safeQty,
    });
    setBusyMode(null);

    if (!res.ok) {
      setErrorMessage(res.error.message);
      setLiveStatus(res.error.message);
      void notifyError(res.error.message);
      return;
    }

    visitorStore.setLatestCart(res.data);

    if (mode === "buy") {
      handleOpenChange(false);
      router.push("/checkout");
      return;
    }

    onAdded?.(selectedVariant.title);
    setAddedSuccess(true);
    const addedMessage = fill(ui.productCard.quickSelect.addedToast, {
      name: product.name,
      variant: selectedVariant.title,
    });
    setLiveStatus(addedMessage);
    void notifySuccess(addedMessage);

    closeTimerRef.current = setTimeout(() => {
      handleOpenChange(false);
    }, 1200);
  }

  const TitleComponent = isMobile ? SheetTitle : DialogTitle;
  const DescriptionComponent = isMobile ? SheetDescription : DialogDescription;

  const headerSection = (
    <div className="shrink-0 border-b border-border px-4 pt-2 pb-4 sm:px-6 sm:pt-6">
      <div className="flex items-start gap-3.5">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAltText ?? product.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pr-2">
          <p className="truncate text-[11px] font-medium tracking-[0.06em] text-text-muted uppercase">
            {product.categoryName}
          </p>
          <TitleComponent
            id={titleId}
            className="mt-0.5 line-clamp-2 text-base leading-snug font-semibold text-text"
          >
            {product.name}
          </TitleComponent>
          <DescriptionComponent className="sr-only">
            {fill(ui.productCard.quickSelect.dialogDescription, { name: product.name })}
          </DescriptionComponent>
          <div className="mt-1">
            <Price
              amount={selectedVariant?.price ?? product.basePrice}
              compareAtAmount={selectedVariant?.compareAtPrice ?? product.compareAtPrice}
              isPriceOnRequest={product.priceMode === "PRICE_ON_REQUEST"}
              animate
              className="text-[18px] font-semibold tabular-nums"
            />
          </div>
          <Link
            href={`/products/${product.slug}`}
            onClick={() => handleOpenChange(false)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-text underline-offset-4 hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span>{ui.productCard.quickSelect.viewDetails}</span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          aria-label={ui.productCard.quickSelect.closeAria}
          className="transition-ui -mt-1 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const groupedSelectors = grouping.mode === "grouped" && (
    <div className="space-y-4">
      {grouping.metals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-[0.06em] text-text-2 uppercase">
              {ui.productCard.quickSelect.metal}
            </span>
            {grouping.metals.length === 1 && (
              <span className="text-xs font-medium text-text">{grouping.metals[0]}</span>
            )}
          </div>
          {grouping.metals.length >= 2 && (
            <div
              role="radiogroup"
              aria-label={ui.productCard.quickSelect.metalAria}
              className="flex flex-wrap gap-2"
            >
              {grouping.metals.map((metal) => {
                const isSelected = (selectedVariant?.metal?.trim() ?? null) === metal;
                const candidate = findMatchingVariant(
                  product.variants,
                  {
                    metal,
                    size: selectedVariant?.size?.trim() ?? null,
                    stoneSpec: selectedVariant?.stoneSpec?.trim() ?? null,
                  },
                  false,
                );
                const anyInStock = product.variants.some(
                  (v) => v.metal?.trim() === metal && v.availableStock > 0,
                );
                const diff = candidate ? Number(candidate.price) - basePriceNum : 0;

                return (
                  <button
                    key={metal}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!anyInStock}
                    onClick={() => {
                      const next = findMatchingVariant(
                        product.variants,
                        {
                          metal,
                          size: selectedVariant?.size?.trim() ?? null,
                          stoneSpec: selectedVariant?.stoneSpec?.trim() ?? null,
                        },
                        true,
                      );
                      if (next) selectVariant(next.id);
                    }}
                    className={cn(
                      "transition-ui inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
                      isSelected
                        ? "border-[1.5px] border-accent bg-accent-tint text-text"
                        : "border-border bg-surface text-text hover:border-border-strong",
                    )}
                  >
                    <span>{metal}</span>
                    {Number.isFinite(diff) && Math.abs(diff) > 0.009 && (
                      <span className="text-xs text-text-muted tabular-nums">
                        {diff > 0 ? "+" : "-"}
                        {formatPrice(Math.abs(diff))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {grouping.stoneSpecs.length >= 2 && (
        <div className="space-y-2">
          <span className="block text-xs font-semibold tracking-[0.06em] text-text-2 uppercase">
            {ui.productCard.quickSelect.caratStone}
          </span>
          <div
            role="radiogroup"
            aria-label={ui.productCard.quickSelect.caratAria}
            className="flex flex-wrap gap-2"
          >
            {grouping.stoneSpecs.map((spec) => {
              const isSelected = (selectedVariant?.stoneSpec?.trim() ?? null) === spec;
              const anyInStock = product.variants.some(
                (v) => v.stoneSpec?.trim() === spec && v.availableStock > 0,
              );
              return (
                <button
                  key={spec}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!anyInStock}
                  onClick={() => {
                    const next = findMatchingVariant(
                      product.variants,
                      {
                        stoneSpec: spec,
                        size: selectedVariant?.size?.trim() ?? null,
                        metal: selectedVariant?.metal?.trim() ?? null,
                      },
                      true,
                    );
                    if (next) selectVariant(next.id);
                  }}
                  className={cn(
                    "transition-ui inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3.5 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
                    isSelected
                      ? "border-[1.5px] border-accent bg-accent-tint text-text"
                      : "border-border bg-surface text-text hover:border-border-strong",
                  )}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {grouping.sizes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-[0.06em] text-text-2 uppercase">
              {ui.productCard.quickSelect.size}
            </span>
            {product.hasSizing && (
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-medium text-accent-text underline-offset-4 hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Ruler className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                <span>{ui.productCard.quickSelect.sizeGuide}</span>
              </button>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label={ui.productCard.quickSelect.sizeAria}
            className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          >
            {grouping.sizes.map((size) => {
              const matchingVariant = findMatchingVariant(
                product.variants,
                {
                  size,
                  metal: selectedVariant?.metal?.trim() ?? null,
                  stoneSpec: selectedVariant?.stoneSpec?.trim() ?? null,
                },
                false,
              );
              const isSelected = (selectedVariant?.size?.trim() ?? null) === size;
              const isOut = !matchingVariant || matchingVariant.availableStock <= 0;

              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={
                    isOut
                      ? fill(ui.productCard.quickSelect.sizeSoldOutAria, {
                          size: formatSizePillLabel(size),
                        })
                      : fill(ui.productCard.quickSelect.sizeAriaLabel, {
                          size: formatSizePillLabel(size),
                        })
                  }
                  disabled={isOut}
                  onClick={() => matchingVariant && selectVariant(matchingVariant.id)}
                  className={cn(
                    "transition-ui relative flex min-h-11 cursor-pointer items-center justify-center overflow-hidden rounded-xl border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
                    isSelected
                      ? "border-[1.5px] border-accent bg-accent-tint font-semibold text-text"
                      : "border-border bg-surface text-text hover:border-border-strong",
                  )}
                >
                  <span className="relative z-10">{formatSizePillLabel(size)}</span>
                  {isOut && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-[-20%] top-1/2 h-px -rotate-[22deg] bg-text-muted/70"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">
            {selectedVariant.stoneSpec && grouping.stoneSpecs.length < 2
              ? selectedVariant.stoneSpec
              : ui.productCard.quickSelect.availability}
          </span>
          {(() => {
            const stock = formatStockLabel(
              selectedVariant.availableStock,
              ui.productCard.quickSelect,
            );
            return (
              <span
                className={cn(
                  stock.tone === "warning" && "font-medium text-warning",
                  stock.tone === "muted" && "text-text-muted",
                  stock.tone === "sold" && "font-medium text-text-muted",
                )}
              >
                {stock.text}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );

  const radioListSelector = grouping.mode === "radio" && (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.06em] text-text-2 uppercase">
          {ui.productCard.quickSelect.selectOption}
        </span>
        {product.hasSizing && (
          <button
            type="button"
            onClick={() => setSizeGuideOpen(true)}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1 text-xs font-medium text-accent-text underline-offset-4 hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Ruler className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>{ui.productCard.quickSelect.sizeGuide}</span>
          </button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={ui.productCard.quickSelect.optionsAria}
        className="space-y-2"
      >
        {product.variants.map((variant) => {
          const isSelected = variant.id === selectedVariant?.id;
          const outOfStock = variant.availableStock <= 0;
          const secondaryParts = [variant.metal, variant.stoneSpec].filter((part): part is string =>
            Boolean(part && part !== variant.title),
          );
          const secondaryLine = secondaryParts.join(" · ");
          const priceDiff = Number(variant.price) - basePriceNum;
          const showPriceDiff = Number.isFinite(priceDiff) && Math.abs(priceDiff) > 0.009;
          const stock = formatStockLabel(variant.availableStock, ui.productCard.quickSelect);

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={outOfStock}
              onClick={() => selectVariant(variant.id)}
              className={cn(
                "transition-ui flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
                isSelected
                  ? "border-[1.5px] border-accent bg-accent-tint"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected ? "border-accent bg-accent" : "border-border-strong bg-surface",
                )}
              >
                {isSelected && <span className="size-2 rounded-full bg-on-accent" />}
              </span>

              <div className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-medium break-words text-text">
                  {variant.title}
                </span>
                {secondaryLine && (
                  <span className="mt-0.5 block text-[13px] leading-snug break-words text-text-muted">
                    {secondaryLine}
                  </span>
                )}
              </div>

              <div className="shrink-0 text-right">
                {showPriceDiff && (
                  <span className="tabular-nums-price block text-sm font-semibold text-text">
                    {priceDiff > 0 ? "+" : "-"}
                    {formatPrice(Math.abs(priceDiff))}
                  </span>
                )}
                <span
                  className={cn(
                    "block text-xs",
                    stock.tone === "warning" && "font-medium text-warning",
                    stock.tone === "muted" && "text-text-muted",
                    stock.tone === "sold" && "font-medium text-text-muted",
                  )}
                >
                  {stock.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const scrollableBody = (
    <div className="drawer-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
      <div aria-live="polite" className="sr-only">
        {liveStatus}
      </div>

      {groupedSelectors}
      {radioListSelector}

      {product.priceMode === "FIXED" && availableStock > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text">
              {ui.productCard.quickSelect.quantity}
            </span>
            <QuantityStepper value={safeQty} min={1} max={maxQty} onChange={setQuantity} />
          </div>
          {isAtMaxStock && (
            <p className="mt-1.5 text-right text-xs text-warning">
              {ui.productCard.quickSelect.maxReached}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const footerSection = (
    <div className="shrink-0 border-t border-border bg-popover px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-4 sm:pb-6">
      {errorMessage && (
        <div
          role="alert"
          className="bg-danger-tint text-danger-text mb-3 flex items-start gap-2 rounded-lg border border-danger/30 px-3 py-2 text-xs"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {product.priceMode === "PRICE_ON_REQUEST" ? (
        <Button asChild size="lg" className="h-12 w-full" onClick={() => handleOpenChange(false)}>
          <Link href={`/contact?type=BESPOKE&product=${encodeURIComponent(product.name)}`}>
            {ui.productCard.quickSelect.enquireConcierge}
          </Link>
        </Button>
      ) : availableStock <= 0 ? (
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
          <Button
            type="button"
            size="lg"
            disabled
            className="h-12 min-h-12 w-full min-[420px]:w-auto min-[420px]:flex-1"
          >
            {ui.productCard.quickSelect.soldOut}
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 min-h-12 w-full min-[420px]:w-auto min-[420px]:flex-1"
            onClick={() => handleOpenChange(false)}
          >
            <Link href={`/contact?type=GENERAL&product=${encodeURIComponent(product.name)}`}>
              {ui.productCard.quickSelect.conciergeEnquiry}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between sm:hidden">
            <span className="text-xs font-medium text-text-muted">
              {ui.productCard.quickSelect.total}
            </span>
            <span className="tabular-nums-price text-base font-semibold text-text">
              {formatPrice(lineTotalNum)}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 min-[420px]:flex-row">
            <Button
              type="button"
              size="lg"
              disabled={busyMode !== null || addedSuccess}
              onClick={() => void submitCart("bag")}
              className={cn(
                "h-12 min-h-12 w-full gap-2 min-[420px]:w-auto min-[420px]:flex-1",
                addedSuccess && "bg-success text-on-primary hover:bg-success",
              )}
            >
              {busyMode === "bag" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : addedSuccess ? (
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <ShoppingBag className="size-4" strokeWidth={1.5} aria-hidden="true" />
              )}
              <span>
                {busyMode === "bag"
                  ? ui.productCard.quickSelect.adding
                  : addedSuccess
                    ? ui.productCard.quickSelect.added
                    : ui.productCard.quickSelect.addToBag}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busyMode !== null || addedSuccess}
              onClick={() => void submitCart("buy")}
              className="h-12 min-h-12 w-full gap-2 min-[420px]:w-auto min-[420px]:flex-1"
            >
              {busyMode === "buy" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              )}
              <span>
                {busyMode === "buy"
                  ? ui.productCard.quickSelect.preparing
                  : ui.productCard.quickSelect.buyNow}
              </span>
            </Button>
          </div>
        </div>
      )}

      {product.isCustomizable && product.priceMode !== "PRICE_ON_REQUEST" && (
        <div className="mt-2.5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              handleOpenChange(false);
              openAtelierCustomization(product.slug);
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Sparkles className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span>{ui.productCard.quickSelect.customizeLink}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            showDragHandle
            hideClose
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[20px] p-0 pb-0"
          >
            {headerSection}
            {scrollableBody}
            {footerSection}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            hideClose
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[90dvh] w-[480px] max-w-[92vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:w-[480px] sm:max-w-[92vw] sm:rounded-2xl sm:p-0 md:w-[520px] lg:w-[480px]"
          >
            {headerSection}
            {scrollableBody}
            {footerSection}
          </DialogContent>
        </Dialog>
      )}

      <RingSizeGuideSheet open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />
    </>
  );
}
