"use client";

import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { Float } from "@/components/motion/Float";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { Button } from "@/components/ui/button";
import { CustomizedSpecsBadge } from "@/components/shared/CustomizedSpecsBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fadeInVariants,
  staggerContainerVariants,
  staggerItemVariants,
  useReducedMotionSafe,
} from "@/lib/motion";
import { removeCartItemAction, updateCartItemQtyAction } from "@/modules/cart/cart.actions";
import type { CartSummaryDTO } from "@/modules/cart/cart.service";
import { useVisitorState, visitorStore } from "@/modules/storefront/visitor-store";

interface CartDrawerSummaryResponse {
  cart: CartSummaryDTO;
  currency: string;
  freeShippingThreshold: string | null;
}

export function CartDrawer() {
  const { formatPrice, currency } = useCurrency();
  const visitor = useVisitorState();
  const t = useUiText().cart;
  const d = t.drawer;
  const cart = visitor.latestCart;
  const [drawerConfig, setDrawerConfig] = React.useState<{
    freeShippingThreshold: string | null;
    loaded: boolean;
  }>({
    freeShippingThreshold: null,
    loaded: false,
  });
  const [busyVariantId, setBusyVariantId] = React.useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = React.useState("");
  const reducedMotion = useReducedMotionSafe();

  const freeShippingThreshold = drawerConfig.freeShippingThreshold;
  const loading = visitor.cartDrawerOpen && !drawerConfig.loaded && cart === null;

  const formatPriceRef = React.useRef(formatPrice);
  React.useEffect(() => {
    formatPriceRef.current = formatPrice;
  }, [formatPrice]);

  React.useEffect(() => {
    if (!visitor.cartDrawerOpen) return;

    let active = true;
    fetch("/api/cart/summary", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<CartDrawerSummaryResponse>) : null))
      .then((data) => {
        if (!active || !data) return;
        setDrawerConfig({
          freeShippingThreshold: data.freeShippingThreshold,
          loaded: true,
        });
        visitorStore.setLatestCart(data.cart);
        setLiveAnnouncement(
          data.cart.itemCount === 0
            ? d.liveEmpty
            : fill(d.liveSummary, {
                count: data.cart.itemCount,
                items: data.cart.itemCount === 1 ? t.item : t.items,
                subtotal: formatPriceRef.current(data.cart.subtotal, { exact: true }),
              }),
        );
      })
      .catch(() => {
        if (active) {
          setDrawerConfig((prev) => ({ ...prev, loaded: true }));
        }
      });

    return () => {
      active = false;
    };
  }, [visitor.cartDrawerOpen, d, t]);

  async function handleQuantityChange(variantId: string, nextQty: number, cartItemId?: string) {
    setBusyVariantId(cartItemId ?? variantId);
    const res = await updateCartItemQtyAction({ variantId, cartItemId, quantity: nextQty });
    setBusyVariantId(null);

    if (!res.ok) {
      void notifyError(res.error.message);
      setLiveAnnouncement(res.error.message);
      return;
    }

    visitorStore.setLatestCart(res.data);
    setLiveAnnouncement(
      fill(d.liveUpdated, {
        count: res.data.itemCount,
        items: res.data.itemCount === 1 ? t.item : t.items,
        subtotal: formatPrice(res.data.subtotal, { exact: true }),
      }),
    );
  }

  async function handleRemoveItem(variantId: string, name: string, cartItemId?: string) {
    setBusyVariantId(cartItemId ?? variantId);
    const res = await removeCartItemAction({ variantId, cartItemId });
    setBusyVariantId(null);

    if (!res.ok) {
      void notifyError(res.error.message);
      setLiveAnnouncement(res.error.message);
      return;
    }

    const updatedItems = (cart?.items ?? []).filter((item) =>
      cartItemId ? item.id !== cartItemId : item.variantId !== variantId,
    );
    const nextCart: CartSummaryDTO = {
      id: cart?.id ?? null,
      currency: cart?.currency ?? currency.code,
      itemCount: res.data.itemCount,
      subtotal: res.data.subtotal,
      items: updatedItems,
      signatureRequired: updatedItems.length > 0 ? (cart?.signatureRequired ?? false) : false,
    };
    visitorStore.setLatestCart(nextCart);
    void notifySuccess(fill(d.removedToast, { name }));
    setLiveAnnouncement(
      res.data.itemCount === 0
        ? fill(d.liveRemovedEmpty, { name })
        : fill(d.liveRemoved, {
            name,
            count: res.data.itemCount,
            items: res.data.itemCount === 1 ? t.item : t.items,
            subtotal: formatPrice(res.data.subtotal, { exact: true }),
          }),
    );
  }

  const subtotalNum = Number(cart?.subtotal ?? "0");
  const thresholdNum = freeShippingThreshold ? Number(freeShippingThreshold) : null;
  const remainingForFreeShipping =
    thresholdNum && Number.isFinite(thresholdNum) && thresholdNum > 0
      ? Math.max(0, thresholdNum - subtotalNum)
      : null;
  const freeShippingProgressPct =
    thresholdNum && Number.isFinite(thresholdNum) && thresholdNum > 0
      ? Math.min(100, Math.round((subtotalNum / thresholdNum) * 100))
      : 100;

  return (
    <Sheet
      open={visitor.cartDrawerOpen}
      onOpenChange={(open) => visitorStore.setCartDrawerOpen(open)}
    >
      <SheetContent
        side="right"
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[420px] sm:max-w-[420px] md:w-[440px] md:max-w-[440px]"
      >
        <SheetHeader className="shrink-0 border-b border-border pt-[max(1rem,env(safe-area-inset-top,0px))] pr-14 pb-3.5 pl-4 sm:pt-[max(1.25rem,env(safe-area-inset-top,0px))] sm:pr-14 sm:pb-4 sm:pl-6">
          <SheetTitle className="text-lg font-semibold tracking-[-0.015em] sm:text-xl">
            {fill(d.title, { count: cart?.itemCount ?? visitor.bagCount })}
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {d.subtitle}
          </SheetDescription>
        </SheetHeader>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>

        {thresholdNum !== null && thresholdNum > 0 && (
          <div className="shrink-0 border-b border-border bg-surface-2 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-xs text-foreground">
              <span className="flex min-w-0 items-center gap-2 leading-snug font-medium">
                <ShieldCheck
                  className="size-4 shrink-0 stroke-[1.5] text-accent-text sm:size-5"
                  aria-hidden="true"
                />
                {remainingForFreeShipping && remainingForFreeShipping > 0 ? (
                  <span>
                    {fill(d.freeShippingRemaining, {
                      amount: formatPrice(remainingForFreeShipping.toFixed(2)),
                    })}
                  </span>
                ) : (
                  <span>{d.freeShippingUnlocked}</span>
                )}
              </span>
              <span className="tabular-nums-price shrink-0 font-semibold text-muted-foreground">
                {freeShippingProgressPct}%
              </span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={freeShippingProgressPct}
              aria-label={d.freeShippingProgressAria}
            >
              <div
                className="ma-progress-fill h-full w-full bg-accent"
                style={{
                  transform: `scaleX(${Math.min(1, Math.max(0, freeShippingProgressPct / 100))})`,
                }}
              />
            </div>
          </div>
        )}

        <div className="drawer-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-5">
          {loading && !cart ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <m.div
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
              className="flex min-h-full flex-col items-center justify-center py-10 text-center"
            >
              <Float amplitude={5} duration={6.5}>
                <div className="flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text">
                  <ShoppingBag className="size-5 stroke-[1.5]" aria-hidden="true" />
                </div>
              </Float>
              <p className="mt-4 text-lg font-semibold tracking-[-0.015em] text-foreground">
                {d.emptyTitle}
              </p>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {d.emptyText}
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6"
                onClick={() => visitorStore.closeCartDrawer()}
              >
                <Link href="/collections">{d.emptyAction}</Link>
              </Button>
            </m.div>
          ) : (
            <m.ul
              variants={reducedMotion ? undefined : staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <AnimatePresence initial={false}>
                {cart.items.map((item) => {
                  const maxStock = Math.max(1, Math.min(10, item.availableStock));
                  const isSeedImage = item.imageUrl?.startsWith("/images/seed/") ?? false;
                  const isBusy = busyVariantId === item.id || busyVariantId === item.variantId;
                  return (
                    <m.li
                      key={item.id || item.variantId}
                      variants={reducedMotion ? fadeInVariants : staggerItemVariants}
                      exit={
                        reducedMotion
                          ? { opacity: 0, transition: { duration: 0.12 } }
                          : { opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.18 } }
                      }
                      className="rounded-xl border border-border bg-card p-3.5 shadow-xs sm:p-4"
                    >
                      <div className="flex items-start gap-3 sm:gap-3.5">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={() => visitorStore.closeCartDrawer()}
                          className="ma-media-placeholder relative size-[68px] shrink-0 overflow-hidden rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:size-[76px]"
                        >
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.imageAltText ?? item.productName}
                              fill
                              sizes="80px"
                              className={
                                isSeedImage
                                  ? "object-cover object-center dark:brightness-90"
                                  : "object-cover object-center"
                              }
                            />
                          ) : null}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/products/${item.productSlug}`}
                              onClick={() => visitorStore.closeCartDrawer()}
                              className="line-clamp-2 text-sm leading-snug font-semibold text-foreground underline-offset-4 hover:text-accent-text hover:underline"
                            >
                              {item.productName}
                            </Link>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="-mt-1.5 -mr-1.5 size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={fill(d.removeAria, { name: item.productName })}
                              disabled={isBusy}
                              onClick={() =>
                                void handleRemoveItem(item.variantId, item.productName, item.id)
                              }
                            >
                              <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                            </Button>
                          </div>

                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.variantTitle}
                            {item.size ? ` · Size ${item.size}` : ""}
                          </p>

                          {item.quantity > 1 && (
                            <p className="tabular-nums-price mt-1 text-xs text-muted-foreground">
                              {fill(d.each, {
                                amount: formatPrice(item.unitPrice, { exact: true }),
                              })}
                            </p>
                          )}

                          {item.isCustomized ? (
                            <CustomizedSpecsBadge
                              requestId={item.customizationRequestId}
                              requestNumber={item.customizationRequestNumber}
                              summaryLines={item.customizationSummaryLines}
                            />
                          ) : null}

                          {item.availableStock <= 0 ? (
                            <p className="mt-1.5 text-xs font-medium text-destructive">
                              {d.soldOut}
                            </p>
                          ) : item.hasStockIssue ? (
                            <p className="mt-1.5 text-xs font-medium text-destructive">
                              {fill(d.onlyLeft, { count: item.availableStock })}
                            </p>
                          ) : item.availableStock <= 3 ? (
                            <p className="mt-1.5 text-xs font-medium text-accent-text">
                              {fill(d.inStock, { count: item.availableStock })}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                        {item.isCustomized ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {d.customQty}
                          </span>
                        ) : (
                          <QuantityStepper
                            size="compact"
                            value={item.quantity}
                            min={1}
                            max={maxStock}
                            disabled={isBusy || item.availableStock <= 0}
                            onChange={(qty) =>
                              void handleQuantityChange(item.variantId, qty, item.id)
                            }
                            label={fill(d.quantityLabel, { name: item.productName })}
                          />
                        )}
                        <p className="tabular-nums-price text-right text-sm font-semibold whitespace-nowrap text-foreground sm:text-base">
                          <AnimatedCounter value={formatPrice(item.lineTotal, { exact: true })} />
                        </p>
                      </div>
                    </m.li>
                  );
                })}
              </AnimatePresence>
            </m.ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="shrink-0 border-t border-border bg-card px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-4 sm:pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-muted-foreground">{d.subtotal}</span>
              <span className="tabular-nums-price text-lg font-semibold tracking-tight whitespace-nowrap text-foreground sm:text-xl">
                <AnimatedCounter value={formatPrice(cart.subtotal, { exact: true })} />
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.taxNote}</p>
            <div className="mt-3.5 flex flex-col items-center gap-2">
              <Button
                asChild
                size="lg"
                onClick={() => visitorStore.closeCartDrawer()}
                className="w-full"
              >
                <Link href="/checkout">{d.checkout}</Link>
              </Button>
              <button
                type="button"
                onClick={() => visitorStore.closeCartDrawer()}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {d.continueShopping}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
