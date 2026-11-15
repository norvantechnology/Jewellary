"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { ProductDescription } from "@/components/storefront/ProductDescription";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Gem,
  Loader2,
  Lock,
  MessageSquare,
  MessagesSquare,
  RotateCcw,
  Ruler,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { openAtelierChat, openAtelierCustomization } from "@/lib/atelier-events";
import { Price } from "@/components/shared/Price";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { RingSizeGuideSheet } from "@/components/storefront/RingSizeGuideSheet";
import { WishlistToggleButton } from "@/components/storefront/WishlistToggleButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { flyThumbnailToBag } from "@/lib/fly-to-bag";
import {
  MOTION_EASE,
  MOTION_TRANSITIONS,
  sheetBottomVariants,
  useFlipIndicator,
  useReducedMotionSafe,
} from "@/lib/motion";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { addToCartAction } from "@/modules/cart/cart.actions";
import type { PublicProductDetailDTO } from "@/modules/catalog/catalog.public";
import { visitorStore } from "@/modules/storefront/visitor-store";

const LazyProductEnquiryDialog = dynamic(
  () => import("@/components/storefront/ProductEnquiryDialog").then((m) => m.ProductEnquiryDialog),
  { ssr: false },
);

interface ProductDetailClientProps {
  product: PublicProductDetailDTO;
  currency: string;
  freeShippingThreshold: string | null;
  signatureThreshold: string;
  returnWindowDays: number;
}

export function ProductDetailClient({
  product,
  freeShippingThreshold,
  signatureThreshold,
  returnWindowDays,
}: ProductDetailClientProps) {
  const ui = useUiText();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const reducedMotion = useReducedMotionSafe();
  const initialVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;

  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(
    initialVariant?.id ?? null,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [addingToBag, setAddingToBag] = React.useState(false);
  const [addedRecently, setAddedRecently] = React.useState(false);
  const [buyingNow, setBuyingNow] = React.useState(false);
  const [liveStatus, setLiveStatus] = React.useState("");
  const [enquiryOpen, setEnquiryOpen] = React.useState(false);
  const [hasOpenedEnquiry, setHasOpenedEnquiry] = React.useState(false);
  const [ringSizeOpen, setRingSizeOpen] = React.useState(false);
  const [showMobileStickyCta, setShowMobileStickyCta] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const addedTimerRef = React.useRef<number | null>(null);
  const variantGroupRef = React.useRef<HTMLDivElement>(null);
  const primaryCtaSentinelRef = React.useRef<HTMLDivElement>(null);
  const addToBagBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const checkViewport = () => {
      if (!vv) return;
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
          if (!vv || window.innerHeight - vv.height <= 150) {
            setKeyboardOpen(false);
          }
        }
      }, 60);
    };

    vv?.addEventListener("resize", checkViewport);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv?.removeEventListener("resize", checkViewport);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  React.useEffect(() => {
    const sentinel = primaryCtaSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setShowMobileStickyCta(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function openEnquiry() {
    setHasOpenedEnquiry(true);
    setEnquiryOpen(true);
  }

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? initialVariant;
  // Rings whose variants only differ by size: show compact size chips instead of long cards.
  const sizeOnly =
    product.variants.length > 1 &&
    product.variants.every((v) => v.size) &&
    new Set(product.variants.map((v) => `${v.metal ?? ""}|${v.stoneSpec ?? ""}`)).size === 1;
  const sizeValue = (size: string | null) => {
    const m = (size ?? "").match(/(\d+(?:\.\d+)?)(?:\s+(\d)\/(\d))?/);
    return m ? Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0) : 0;
  };
  const sizeVariants = sizeOnly
    ? [...product.variants].sort((a, b) => sizeValue(a.size) - sizeValue(b.size))
    : product.variants;

  useFlipIndicator(variantGroupRef, selectedVariant?.id ?? null, reducedMotion);

  const availableStock = selectedVariant?.availableStock ?? 0;
  const maxSelectableQty = Math.min(10, Math.max(1, availableStock));
  const safeQuantity = Math.min(quantity, maxSelectableQty);

  async function handleAddToBag() {
    if (!selectedVariant || product.priceMode !== "FIXED" || availableStock <= 0) {
      return;
    }

    setAddingToBag(true);
    const result = await addToCartAction({
      variantId: selectedVariant.id,
      quantity: safeQuantity,
    });
    setAddingToBag(false);

    if (!result.ok) {
      setLiveStatus(result.error.message);
      void notifyError(result.error.message);
      return;
    }

    if (!reducedMotion) {
      const activeStage = document.querySelector<HTMLElement>('[data-pdp-active-image="true"]');
      const activeImg = activeStage?.querySelector<HTMLImageElement>("img");
      const thumbUrl = activeImg?.currentSrc || activeImg?.getAttribute("src") || null;
      flyThumbnailToBag(activeStage ?? addToBagBtnRef.current, thumbUrl);
    }

    visitorStore.setLatestCart(result.data);
    visitorStore.openCartDrawer();
    setAddedRecently(true);
    setLiveStatus(`${product.name} (${selectedVariant.title}) added to bag.`);
    if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedRecently(false), 2000);
    void notifySuccess(
      fill(ui.product.addedToast, { name: product.name, variant: selectedVariant.title }),
    );
  }

  async function handleBuyNow() {
    if (!selectedVariant || product.priceMode !== "FIXED" || availableStock <= 0) {
      return;
    }

    setBuyingNow(true);
    const result = await addToCartAction({
      variantId: selectedVariant.id,
      quantity: safeQuantity,
    });
    setBuyingNow(false);

    if (!result.ok) {
      setLiveStatus(result.error.message);
      void notifyError(result.error.message);
      return;
    }

    visitorStore.setLatestCart(result.data);
    router.push("/checkout");
  }

  const specRows: Array<{ label: string; value: string }> = [];
  if (product.metalType) {
    specRows.push({
      label: ui.product.specs.metal,
      value: [product.metalPurity, product.metalType].filter(Boolean).join(" "),
    });
  }
  if (selectedVariant?.weightGrams ?? product.metalWeightGrams) {
    specRows.push({
      label: ui.product.specs.metalWeight,
      value: `${selectedVariant?.weightGrams ?? product.metalWeightGrams} g`,
    });
  }
  if (product.stoneOrigin) {
    specRows.push({ label: ui.product.specs.stoneOrigin, value: product.stoneOrigin });
  }
  if (product.stoneShape) {
    specRows.push({ label: ui.product.specs.cutShape, value: product.stoneShape });
  }
  if (product.caratTotal) {
    specRows.push({
      label: ui.product.specs.caratTotal,
      value: `${product.caratTotal} ct`,
    });
  }
  if (product.caratCenter) {
    specRows.push({
      label: ui.product.specs.caratCenter,
      value: `${product.caratCenter} ct`,
    });
  }
  if (product.colorGrade) {
    specRows.push({ label: ui.product.specs.colourGrade, value: product.colorGrade });
  }
  if (product.clarityGrade) {
    specRows.push({ label: ui.product.specs.clarityGrade, value: product.clarityGrade });
  }
  if (product.cutGrade) {
    specRows.push({ label: ui.product.specs.cutGrade, value: product.cutGrade });
  }
  if (product.polishGrade || product.symmetryGrade) {
    specRows.push({
      label: ui.product.specs.polishSymmetry,
      value: [product.polishGrade, product.symmetryGrade].filter(Boolean).join(" / "),
    });
  }
  if (product.fluorescence) {
    specRows.push({ label: ui.product.specs.fluorescence, value: product.fluorescence });
  }
  if (product.certificationLab) {
    specRows.push({
      label: ui.product.specs.labCertification,
      value: product.certificateNumber
        ? `${product.certificationLab} · #${product.certificateNumber}`
        : product.certificationLab,
    });
  }
  for (const attr of product.attributes) {
    if (!specRows.some((r) => r.label.toLowerCase() === attr.facetName.toLowerCase())) {
      specRows.push({
        label: attr.facetName,
        value: attr.unit ? `${attr.valueLabel} ${attr.unit}` : attr.valueLabel,
      });
    }
  }

  return (
    <div className="space-y-6 pb-24 sm:space-y-8 sm:pb-0">
      <div className="space-y-3 border-b border-border pb-6 sm:space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {product.categoryName}
          </span>
          {product.certificationLab && (
            <Badge variant="outline">{product.certificationLab} Certified</Badge>
          )}
          <span className="font-mono text-xs break-all text-muted-foreground">
            SKU: {selectedVariant?.sku ?? product.sku}
          </span>
        </div>

        <h1 className="type-h1 font-display font-semibold break-words text-foreground">
          {product.name}
        </h1>

        {product.subtitle && (
          <p className="prose-limit text-base leading-relaxed text-muted-foreground">
            {product.subtitle}
          </p>
        )}

        <div className="pt-1">
          <Price
            amount={selectedVariant?.price ?? product.basePrice}
            compareAtAmount={selectedVariant?.compareAtPrice ?? product.compareAtPrice}
            isPriceOnRequest={product.priceMode === "PRICE_ON_REQUEST"}
            animate
            size="lg"
          />
        </div>
      </div>

      {product.variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {product.hasSizing ? ui.product.sizeHeading : ui.product.optionHeading}
            </p>
            {product.hasSizing && (
              <button
                type="button"
                onClick={() => setRingSizeOpen(true)}
                className="ma-link-underline inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-medium text-accent-text"
              >
                <Ruler className="size-4" strokeWidth={1.5} aria-hidden="true" />
                <span>{ui.product.ringSizeGuide}</span>
              </button>
            )}
          </div>

          {sizeOnly ? (
            <div>
              <p className="mb-2.5 text-xs text-text-muted">
                {fill(ui.product.sizeOnlyMetal, {
                  metal: selectedVariant?.metal ?? "",
                  stone: selectedVariant?.stoneSpec ?? "",
                })}
              </p>
              <div
                ref={variantGroupRef}
                role="radiogroup"
                aria-label={ui.product.sizeLabel}
                className="grid grid-cols-6 gap-2 sm:grid-cols-8"
              >
                {sizeVariants.map((variant) => {
                  const selected = variant.id === selectedVariant?.id;
                  const label = (variant.size ?? "")
                    .replace(/^US\s*/i, "")
                    .replace(/\s*1\/4$/, "¼")
                    .replace(/\s*1\/2$/, "½")
                    .replace(/\s*3\/4$/, "¾");
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={fill(ui.product.sizeAria, { size: label })}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={cn(
                        "transition-ui relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-1 text-sm font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        selected
                          ? "border-accent bg-accent-tint text-text ring-1 ring-accent"
                          : "border-border bg-surface text-text hover:border-border-strong",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              ref={variantGroupRef}
              role="radiogroup"
              aria-label={ui.product.optionsAria}
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {product.variants.map((variant) => {
                const selected = variant.id === selectedVariant?.id;
                const outOfStock = variant.availableStock <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={cn(
                      "transition-ui relative flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      selected
                        ? "border-transparent text-text"
                        : "border-border bg-surface text-text hover:border-border-strong",
                      outOfStock && !selected ? "opacity-70" : "",
                    )}
                  >
                    {selected ? (
                      <span
                        data-ma-indicator="true"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-lg border-[1.5px] border-accent bg-accent-tint ring-1 ring-accent"
                      />
                    ) : null}
                    <div className="relative z-10 min-w-0">
                      <span className="block truncate text-sm font-medium">{variant.title}</span>
                      {variant.stoneSpec && (
                        <span className="block truncate text-xs text-text-muted">
                          {variant.stoneSpec}
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums-price relative z-10 shrink-0 text-xs text-text-muted">
                      {outOfStock ? ui.product.outOfStock : ui.product.inStock}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedVariant && product.priceMode === "FIXED" && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-sm">
          {availableStock > selectedVariant.lowStockThreshold && (
            <p className="flex items-start gap-2.5 text-text">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-accent-text"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span>{ui.product.inStockShips}</span>
            </p>
          )}
          {availableStock > 0 && availableStock <= selectedVariant.lowStockThreshold && (
            <p className="flex items-start gap-2.5 font-medium text-warning">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span>{fill(ui.product.onlyLeft, { count: availableStock })}</span>
            </p>
          )}
          {availableStock <= 0 && (
            <p className="text-muted-foreground">
              {fill(ui.product.madeToOrder, {
                leadTime: product.leadTimeDays
                  ? fill(ui.product.leadTimeSuffix, { days: product.leadTimeDays })
                  : "",
              })}
            </p>
          )}
        </div>
      )}

      <div
        ref={primaryCtaSentinelRef}
        className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
      >
        <div aria-live="polite" className="sr-only">
          {liveStatus}
        </div>
        {product.priceMode === "FIXED" && availableStock > 0 ? (
          <>
            <div className="col-span-2 flex items-center justify-between gap-4 sm:border-0 sm:bg-transparent sm:p-0">
              <span className="text-sm font-medium text-foreground sm:sr-only">
                {ui.product.quantity}
              </span>
              <QuantityStepper
                value={safeQuantity}
                min={1}
                max={maxSelectableQty}
                onChange={setQuantity}
              />
            </div>
            <Button
              ref={addToBagBtnRef}
              type="button"
              size="lg"
              disabled={addingToBag || buyingNow || !selectedVariant}
              onClick={handleAddToBag}
              className="col-span-2 w-full gap-2 sm:min-w-44 sm:flex-1"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={addingToBag ? "adding" : addedRecently ? "added" : "idle"}
                  initial={reducedMotion ? { opacity: 0.4 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={
                    reducedMotion
                      ? MOTION_TRANSITIONS.reduced
                      : { duration: 0.2, ease: MOTION_EASE.out }
                  }
                  className="inline-flex items-center gap-2"
                >
                  {addingToBag ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  ) : addedRecently ? (
                    <Check className="size-5" aria-hidden="true" />
                  ) : (
                    <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>
                    {addingToBag
                      ? ui.product.addingToBag
                      : addedRecently
                        ? ui.product.added
                        : ui.product.addToBag}
                  </span>
                </m.span>
              </AnimatePresence>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={addingToBag || buyingNow || !selectedVariant}
              onClick={() => void handleBuyNow()}
              className="w-full px-3 sm:w-auto sm:min-w-36 sm:px-6"
            >
              {buyingNow ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{ui.product.preparing}</span>
                </>
              ) : (
                <span>{ui.product.buyNow}</span>
              )}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={openEnquiry}
            className="col-span-2 w-full gap-2 sm:min-w-56 sm:flex-1"
          >
            <MessageSquare className="size-5" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {product.priceMode === "PRICE_ON_REQUEST"
                ? ui.product.requestPrice
                : ui.product.orderMadeToOrder}
            </span>
          </Button>
        )}

        <WishlistToggleButton
          variantId={selectedVariant?.id ?? product.defaultVariantId}
          productName={product.name}
          mode="button"
          className={cn(
            "w-full px-3 sm:w-auto sm:px-6",
            !(product.priceMode === "FIXED" && availableStock > 0) && "col-span-2",
          )}
        />

        {product.isCustomizable && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => openAtelierCustomization(product.slug)}
            className="col-span-2 w-full gap-2 sm:w-auto"
          >
            <Sparkles className="size-5 stroke-[1.5]" aria-hidden="true" />
            <span>{ui.product.customize}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            openAtelierChat({
              contextType: "PRODUCT",
              contextRefId: product.id,
              title: product.name,
            })
          }
          className="col-span-2 min-h-11 w-full gap-1.5 text-text-2 sm:w-auto"
        >
          <MessagesSquare className="size-4" strokeWidth={1.5} aria-hidden="true" />
          <span>{ui.product.askExpert}</span>
        </Button>

        {hasOpenedEnquiry ? (
          <LazyProductEnquiryDialog
            open={enquiryOpen}
            onOpenChange={setEnquiryOpen}
            productId={product.id}
            productName={product.name}
            priceMode={product.priceMode}
            availableStock={availableStock}
          />
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-[13px] text-text-2 sm:text-sm">
        {[
          freeShippingThreshold
            ? {
                icon: Truck,
                text: fill(ui.product.trustShippingOver, {
                  amount: formatPrice(freeShippingThreshold),
                }),
              }
            : null,
          returnWindowDays > 0
            ? { icon: RotateCcw, text: fill(ui.product.trustReturns, { days: returnWindowDays }) }
            : null,
          { icon: Lock, text: ui.product.trustSecure },
          { icon: Gem, text: ui.product.trustHandmade },
        ]
          .filter((item) => item !== null)
          .map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon
                className="size-4 shrink-0 text-accent-text"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span>{text}</span>
            </li>
          ))}
      </ul>

      <section className="space-y-4 border-t border-border pt-6">
        {product.description && <ProductDescription text={product.description} />}
        <Accordion
          type="single"
          collapsible
          className="rounded-xl border border-border bg-surface px-3.5 shadow-sm sm:px-5"
        >
          <AccordionItem value="details">
            <AccordionTrigger
              headingLevel="h2"
              className="min-h-14 py-4 text-left text-base font-medium"
            >
              {ui.product.detailsHeading}
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pt-1 pb-4">
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground">{ui.product.specsHeading}</h3>
                {specRows.length > 0 ? (
                  <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-2">
                    {specRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-3 px-3 py-2 text-[13px] sm:px-4 sm:py-2.5 sm:text-sm"
                      >
                        <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                        <dd className="tabular-nums-price min-w-0 text-right font-medium break-words text-foreground">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">{ui.product.craftedNote}</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="certification">
            <AccordionTrigger
              headingLevel="h2"
              className="min-h-14 py-4 text-left text-base font-medium"
            >
              {ui.product.certificationHeading}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1 pb-4 text-sm text-muted-foreground">
              <p className="prose-limit leading-relaxed">
                {product.certificationLab
                  ? fill(ui.product.certifiedText, {
                      lab: product.certificationLab,
                      certificate: product.certificateNumber
                        ? ` (#${product.certificateNumber})`
                        : "",
                      purity: product.metalPurity ? ` (${product.metalPurity})` : "",
                    })
                  : fill(ui.product.hallmarkedText, {
                      metal: product.metalType ?? ui.product.defaultMetal,
                      purity: product.metalPurity ? ` (${product.metalPurity})` : "",
                    })}
              </p>
              {product.certificateUrl && (
                <a
                  href={product.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent-text hover:underline"
                >
                  <span>{ui.product.viewLabReport}</span>
                  <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </a>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shipping" className="border-b-0">
            <AccordionTrigger
              headingLevel="h2"
              className="min-h-14 py-4 text-left text-base font-medium"
            >
              {ui.product.shippingHeading}
            </AccordionTrigger>
            <AccordionContent className="space-y-2.5 pt-1 pb-4 text-sm text-muted-foreground">
              <p className="prose-limit leading-relaxed">
                {freeShippingThreshold
                  ? fill(ui.product.freeShippingText, {
                      amount: formatPrice(freeShippingThreshold),
                    })
                  : ""}
                {fill(ui.product.signatureText, { amount: formatPrice(signatureThreshold) })}
              </p>
              <p className="prose-limit leading-relaxed">
                {fill(ui.product.returnsText, { days: returnWindowDays })}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <RingSizeGuideSheet open={ringSizeOpen} onOpenChange={setRingSizeOpen} />

      {/* Mobile sticky bottom CTA — slides up after scrolling past primary Add to Bag button; hides on keyboard */}
      <AnimatePresence>
        {showMobileStickyCta && !keyboardOpen ? (
          <m.div
            data-sticky-cta="true"
            variants={sheetBottomVariants}
            initial={reducedMotion ? { opacity: 0 } : "hidden"}
            animate={
              reducedMotion ? { opacity: 1, transition: MOTION_TRANSITIONS.reduced } : "visible"
            }
            exit={reducedMotion ? { opacity: 0, transition: MOTION_TRANSITIONS.reduced } : "exit"}
            className="safe-area-pb fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-border bg-header-bg px-4 py-2.5 shadow-md backdrop-blur-md sm:hidden"
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{product.name}</p>
                <Price
                  amount={selectedVariant?.price ?? product.basePrice}
                  isPriceOnRequest={product.priceMode === "PRICE_ON_REQUEST"}
                  animate
                  size="md"
                />
              </div>
              {product.priceMode === "FIXED" && availableStock > 0 ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="md"
                    disabled={addingToBag || buyingNow || !selectedVariant}
                    onClick={handleAddToBag}
                    className="min-h-11 shrink-0 gap-1.5 px-5"
                  >
                    {addingToBag ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : addedRecently ? (
                      <Check className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <ShoppingBag className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    )}
                    <span>
                      {addingToBag
                        ? ui.product.adding
                        : addedRecently
                          ? ui.product.added
                          : ui.product.addToBag}
                    </span>
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="md"
                  onClick={openEnquiry}
                  className="min-h-11 shrink-0 gap-2"
                >
                  <MessageSquare className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  <span>{ui.product.enquire}</span>
                </Button>
              )}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
