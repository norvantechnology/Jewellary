"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Loader2, ShoppingBag, SlidersHorizontal, Sparkles } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { QuickSelectProductSummary } from "@/components/storefront/QuickSelectVariantModal";
import { Button } from "@/components/ui/button";
import { openAtelierCustomization } from "@/lib/atelier-events";
import { flyThumbnailToBag } from "@/lib/fly-to-bag";
import { addToCartAction } from "@/modules/cart/cart.actions";
import type { PublicProductCardDTO } from "@/modules/catalog/catalog.public";
import { visitorStore } from "@/modules/storefront/visitor-store";

const LazyQuickSelectVariantModal = dynamic(
  () =>
    import("@/components/storefront/QuickSelectVariantModal").then(
      (mod) => mod.QuickSelectVariantModal,
    ),
  { ssr: false },
);

let prefetchedQuickSelect = false;
let prefetchedCustomize = false;

function prefetchQuickSelect() {
  if (prefetchedQuickSelect) return;
  prefetchedQuickSelect = true;
  void import("@/components/storefront/QuickSelectVariantModal");
}

function prefetchCustomize() {
  if (prefetchedCustomize) return;
  prefetchedCustomize = true;
  void import("@/components/storefront/CustomizationSheet");
}

interface ProductCardActionsProps {
  product: PublicProductCardDTO;
}

const ADDED_FEEDBACK_MS = 1200;

export const ProductCardActions = React.memo(function ProductCardActions({
  product,
}: ProductCardActionsProps) {
  const ui = useUiText();
  const [busy, setBusy] = React.useState(false);
  const [addedRecently, setAddedRecently] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [liveStatus, setLiveStatus] = React.useState("");
  const resetTimerRef = React.useRef<number | null>(null);
  const directBtnRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const markAdded = React.useCallback(
    (variantLabel?: string) => {
      setAddedRecently(true);
      setLiveStatus(
        variantLabel
          ? `${product.name} (${variantLabel}) added to bag.`
          : `${product.name} added to bag.`,
      );
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setAddedRecently(false);
      }, ADDED_FEEDBACK_MS);
    },
    [product.name],
  );

  if (product.priceMode === "PRICE_ON_REQUEST") {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-11 min-h-11 w-full rounded-[10px] px-3 text-sm font-medium md:text-[15px]"
      >
        <Link href={`/contact?type=BESPOKE&product=${encodeURIComponent(product.name)}`}>
          <span>{ui.productCard.enquire}</span>
        </Link>
      </Button>
    );
  }

  const purchasableVariants = product.variants.filter((v) => v.availableStock > 0);
  const isOutOfStock = product.totalAvailableStock <= 0 || purchasableVariants.length === 0;

  if (isOutOfStock) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled
        aria-label={`${product.name} is sold out`}
        className="h-11 min-h-11 w-full rounded-[10px] px-3 text-sm font-medium md:text-[15px]"
      >
        {ui.productCard.soldOut}
      </Button>
    );
  }

  const requiresQuickSelect =
    product.variants.length > 1 ||
    (product.hasSizing && product.variants.some((v) => Boolean(v.size)));

  const singleVariant = purchasableVariants[0] ?? product.variants[0] ?? null;

  async function handleDirectAdd() {
    if (!singleVariant || busy) return;
    setBusy(true);
    const res = await addToCartAction({
      variantId: singleVariant.id,
      quantity: 1,
    });
    setBusy(false);

    if (!res.ok) {
      void notifyError(res.error.message);
      setLiveStatus(res.error.message);
      return;
    }

    visitorStore.setLatestCart(res.data);
    markAdded(singleVariant.title);
    flyThumbnailToBag(
      directBtnRef.current,
      product.primaryImage?.mediumUrl ?? product.primaryImage?.url ?? null,
    );
    visitorStore.openCartDrawer();
    void notifySuccess(fill(ui.productCard.addedToast, { name: product.name }));
  }

  const quickSelectSummary: QuickSelectProductSummary = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryName: product.categoryName,
    priceMode: product.priceMode,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    hasSizing: product.hasSizing,
    isCustomizable: product.isCustomizable,
    imageUrl: product.primaryImage?.mediumUrl ?? product.primaryImage?.url ?? null,
    imageAltText: product.primaryImage?.altText ?? product.name,
    variants: product.variants,
  };

  const customizeAction = product.isCustomizable ? (
    <div className="group/cust relative shrink-0">
      <button
        type="button"
        onClick={() => openAtelierCustomization(product.slug)}
        onMouseEnter={prefetchCustomize}
        onFocus={prefetchCustomize}
        onTouchStart={prefetchCustomize}
        aria-label={fill(ui.productCard.customizeAria, { name: product.name })}
        title={ui.productCard.customize}
        className="transition-ui inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-border-strong bg-surface text-accent-text shadow-xs hover:border-accent hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
      >
        <Sparkles className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-[11px] font-medium whitespace-nowrap text-on-primary opacity-0 shadow-sm transition-opacity duration-150 group-focus-within/cust:opacity-100 group-hover/cust:opacity-100 md:block"
      >
        {ui.productCard.customize}
      </span>
    </div>
  ) : null;

  return (
    <div className="flex items-center gap-1.5 min-[361px]:gap-2">
      <div aria-live="polite" className="sr-only">
        {liveStatus}
      </div>

      {requiresQuickSelect ? (
        <>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
            onMouseEnter={prefetchQuickSelect}
            onFocus={prefetchQuickSelect}
            onTouchStart={prefetchQuickSelect}
            aria-label={fill(ui.productCard.chooseOptionsAria, { name: product.name })}
            className="h-11 min-h-11 min-w-0 flex-1 rounded-[10px] px-2 text-[13px] font-medium active:scale-[0.98] min-[1400px]:px-3 min-[1400px]:text-sm sm:px-2.5 sm:text-sm lg:px-2 lg:text-[13px]"
          >
            {addedRecently ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{ui.productCard.added}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal
                  className="hidden size-4 shrink-0 2xl:inline-block"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span className="min-[540px]:hidden">{ui.productCard.options}</span>
                <span className="hidden min-[540px]:inline">{ui.productCard.chooseOptions}</span>
              </span>
            )}
          </Button>
          {modalOpen && (
            <LazyQuickSelectVariantModal
              open={modalOpen}
              onOpenChange={setModalOpen}
              product={quickSelectSummary}
              initialVariantId={product.defaultVariantId}
              onAdded={markAdded}
            />
          )}
        </>
      ) : (
        <Button
          ref={directBtnRef}
          type="button"
          variant="primary"
          size="sm"
          disabled={busy || !singleVariant}
          onClick={() => void handleDirectAdd()}
          aria-label={fill(ui.productCard.addAria, { name: product.name })}
          className="relative h-11 min-h-11 min-w-0 flex-1 rounded-[10px] px-2 text-[13px] font-medium active:scale-[0.98] min-[1400px]:px-3 min-[1400px]:text-sm sm:px-2.5 sm:text-sm lg:px-2 lg:text-[13px]"
        >
          {busy && <Loader2 className="absolute size-4 shrink-0 animate-spin" aria-hidden="true" />}
          <span
            className={
              busy
                ? "invisible inline-flex items-center gap-1.5"
                : "inline-flex items-center gap-1.5"
            }
          >
            {addedRecently ? (
              <>
                <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{ui.productCard.added}</span>
              </>
            ) : (
              <>
                <ShoppingBag
                  className="hidden size-4 shrink-0 2xl:inline-block"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span className="min-[420px]:hidden">{ui.productCard.add}</span>
                <span className="hidden min-[420px]:inline">{ui.productCard.addToBag}</span>
              </>
            )}
          </span>
        </Button>
      )}
      {customizeAction}
    </div>
  );
});
