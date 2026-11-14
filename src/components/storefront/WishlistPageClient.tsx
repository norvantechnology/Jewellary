"use client";

import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Check, Heart, Loader2, ShoppingBag, SlidersHorizontal, Trash2 } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { EmptyState } from "@/components/shared/EmptyState";
import { Price } from "@/components/shared/Price";
import {
  QuickSelectVariantModal,
  type QuickSelectProductSummary,
} from "@/components/storefront/QuickSelectVariantModal";
import { Button } from "@/components/ui/button";
import { MOTION_TRANSITIONS, useReducedMotionSafe } from "@/lib/motion";
import { addToCartAction } from "@/modules/cart/cart.actions";
import { visitorStore } from "@/modules/storefront/visitor-store";
import { removeWishlistItemAction } from "@/modules/wishlist/wishlist.actions";
import type { WishlistItemDTO } from "@/modules/wishlist/wishlist.service";

interface WishlistPageClientProps {
  initialItems: WishlistItemDTO[];
  currency?: string;
}

export function WishlistPageClient({ initialItems }: WishlistPageClientProps) {
  const reducedMotion = useReducedMotionSafe();
  const t = useUiText().wishlist;
  const [items, setItems] = React.useState(initialItems);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [addedIds, setAddedIds] = React.useState<Record<string, boolean>>({});
  const [quickSelectItem, setQuickSelectItem] = React.useState<WishlistItemDTO | null>(null);
  const [liveStatus, setLiveStatus] = React.useState("");

  function markAdded(variantId: string, name: string) {
    setAddedIds((prev) => ({ ...prev, [variantId]: true }));
    setLiveStatus(fill(t.addedLive, { name }));
    window.setTimeout(() => {
      setAddedIds((prev) => {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      });
    }, 1200);
  }

  async function handleRemove(variantId: string) {
    setPendingId(variantId);
    const result = await removeWishlistItemAction({ variantId });
    setPendingId(null);

    if (!result.ok) {
      void notifyError(result.error.message);
      return;
    }

    visitorStore.setWishlistVariantIds(result.data.variantIds);
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
    void notifySuccess(t.removedToast);
  }

  async function handleMoveToBag(item: WishlistItemDTO) {
    if (item.priceMode !== "FIXED" || item.availableStock <= 0) return;

    setPendingId(item.variantId);
    const result = await addToCartAction({ variantId: item.variantId, quantity: 1 });
    setPendingId(null);

    if (!result.ok) {
      void notifyError(result.error.message);
      setLiveStatus(result.error.message);
      return;
    }

    visitorStore.setLatestCart(result.data);
    markAdded(item.variantId, item.productName);
    visitorStore.openCartDrawer();
    void notifySuccess(fill(t.addedToBagToast, { name: item.productName }));
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={t.emptyTitle}
        description={t.emptyDescription}
        actionLabel={t.emptyAction}
        actionHref="/collections"
      />
    );
  }

  const quickSelectSummary: QuickSelectProductSummary | null = quickSelectItem
    ? {
        id: quickSelectItem.productId,
        name: quickSelectItem.productName,
        slug: quickSelectItem.productSlug,
        categoryName: quickSelectItem.categoryName,
        priceMode: quickSelectItem.priceMode,
        basePrice: quickSelectItem.price,
        compareAtPrice: quickSelectItem.compareAtPrice,
        hasSizing: quickSelectItem.hasSizing,
        imageUrl: quickSelectItem.imageUrl,
        imageAltText: quickSelectItem.imageAltText,
        variants: quickSelectItem.variants,
      }
    : null;

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {liveStatus}
      </div>
      <div className="product-grid-default">
        <AnimatePresence initial={false}>
          {items.map((item, itemIndex) => {
            const busy = pendingId === item.variantId;
            const added = Boolean(addedIds[item.variantId]);
            const isSeedImage = item.imageUrl?.startsWith("/images/seed/") ?? false;
            const hasAnyStock =
              item.availableStock > 0 || item.variants.some((v) => v.availableStock > 0);
            const hasOtherOptions = item.variants.length > 1;
            const isOutOfStock = item.priceMode !== "PRICE_ON_REQUEST" && !hasAnyStock;

            return (
              <m.article
                key={item.id}
                initial={false}
                exit={
                  reducedMotion
                    ? { opacity: 0, transition: MOTION_TRANSITIONS.reduced }
                    : { opacity: 0, scale: 0.96, transition: MOTION_TRANSITIONS.fast }
                }
                className="group relative flex h-full scroll-mt-[calc(var(--site-header-h)+1rem)] flex-col rounded-xl border border-border bg-surface shadow-sm transition-[border-color,box-shadow,background-color] duration-200 lg:hover:border-border-strong lg:hover:shadow-md dark:lg:hover:bg-surface-2"
              >
                <div className="ma-media-placeholder relative aspect-[4/5] w-full overflow-hidden rounded-t-xl">
                  {item.imageUrl ? (
                    <Image
                      loading={itemIndex === 0 ? "eager" : "lazy"}
                      src={item.imageUrl}
                      alt={item.imageAltText ?? item.productName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className={`object-cover object-center transition-transform duration-300 ease-out lg:group-hover:scale-[1.03] ${
                        isSeedImage ? "dark:brightness-90" : ""
                      } ${isOutOfStock ? "opacity-75 grayscale-[25%]" : ""}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={fill(t.removeAria, { name: item.productName })}
                    onClick={() => void handleRemove(item.variantId)}
                    className="group/remove absolute top-2 right-2 z-20 inline-flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45"
                  >
                    <span className="transition-ui inline-flex size-9 items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-sm backdrop-blur-sm group-hover/remove:border-danger group-hover/remove:text-danger group-active/remove:scale-95">
                      <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-3 md:p-4">
                  <p className="mb-1 hidden truncate text-[11px] font-medium tracking-[0.08em] text-text-muted uppercase min-[361px]:block">
                    {item.categoryName}
                  </p>
                  <h2 className="mb-1 line-clamp-2 min-h-[2.7em] text-[15px] leading-[1.35] font-medium text-text sm:text-base">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="rounded-sm transition-colors after:absolute after:inset-0 after:z-10 after:content-[''] hover:text-accent-text focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {item.productName}
                    </Link>
                  </h2>
                  <p
                    title={`${item.variantTitle}${item.caratTotal ? ` · ${item.caratTotal} ct` : ""}`}
                    className="tabular-nums-price truncate text-[13px] leading-[1.35] text-text-muted"
                  >
                    {item.variantTitle}
                    {item.caratTotal ? ` · ${item.caratTotal} ct` : ""}
                  </p>

                  <div className="mt-auto space-y-2.5 pt-3">
                    <div className="flex min-h-6 items-baseline justify-between gap-2">
                      <Price
                        amount={item.price}
                        compareAtAmount={item.compareAtPrice}
                        isPriceOnRequest={item.priceMode === "PRICE_ON_REQUEST"}
                        size="md"
                      />
                    </div>

                    <div className="relative z-20">
                      {item.priceMode === "PRICE_ON_REQUEST" ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-11 min-h-11 w-full rounded-[10px] px-3 text-sm font-medium md:text-[15px]"
                        >
                          <Link
                            href={`/contact?type=BESPOKE&product=${encodeURIComponent(item.productName)}`}
                          >
                            {t.enquire}
                          </Link>
                        </Button>
                      ) : !hasAnyStock ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled
                          className="h-11 min-h-11 w-full rounded-[10px] px-3 text-sm font-medium md:text-[15px]"
                        >
                          {t.soldOut}
                        </Button>
                      ) : item.availableStock <= 0 && hasOtherOptions ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setQuickSelectItem(item)}
                          aria-label={fill(t.chooseOptionsAria, { name: item.productName })}
                          className="h-11 min-h-11 w-full rounded-[10px] px-2 text-[13px] font-medium active:scale-[0.98] min-[1400px]:px-3 min-[1400px]:text-sm sm:px-2.5 sm:text-sm lg:px-2 lg:text-[13px]"
                        >
                          <SlidersHorizontal
                            className="hidden size-4 shrink-0 2xl:inline-block"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span className="min-[540px]:hidden">{t.optionsShort}</span>
                          <span className="hidden min-[540px]:inline">{t.chooseOptions}</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleMoveToBag(item)}
                          aria-label={fill(t.addAria, { name: item.productName })}
                          className="relative h-11 min-h-11 w-full rounded-[10px] px-2 text-[13px] font-medium active:scale-[0.98] min-[1400px]:px-3 min-[1400px]:text-sm sm:px-2.5 sm:text-sm lg:px-2 lg:text-[13px]"
                        >
                          {busy && (
                            <Loader2
                              className="absolute size-4 shrink-0 animate-spin"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={
                              busy
                                ? "invisible inline-flex items-center gap-1.5"
                                : "inline-flex items-center gap-1.5"
                            }
                          >
                            {added ? (
                              <>
                                <Check
                                  className="size-4 shrink-0"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                                <span>{t.added}</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag
                                  className="hidden size-4 shrink-0 2xl:inline-block"
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                                <span className="min-[420px]:hidden">{t.addShort}</span>
                                <span className="hidden min-[420px]:inline">{t.addToBag}</span>
                              </>
                            )}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </m.article>
            );
          })}
        </AnimatePresence>
      </div>

      {quickSelectItem && quickSelectSummary && (
        <QuickSelectVariantModal
          open={Boolean(quickSelectItem)}
          onOpenChange={(open) => {
            if (!open) setQuickSelectItem(null);
          }}
          product={quickSelectSummary}
          initialVariantId={quickSelectItem.variantId}
          onAdded={() => markAdded(quickSelectItem.variantId, quickSelectItem.productName)}
        />
      )}
    </>
  );
}
