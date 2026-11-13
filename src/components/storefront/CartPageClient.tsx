"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { CustomizedSpecsBadge } from "@/components/shared/CustomizedSpecsBadge";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AnimatePresence, m } from "motion/react";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Price } from "@/components/shared/Price";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCountryName } from "@/lib/countries";
import { formatMoneyExact } from "@/lib/money";
import { MOTION_TRANSITIONS, staggerItemVariants, useReducedMotionSafe } from "@/lib/motion";
import {
  estimateCartQuoteAction,
  removeCartItemAction,
  saveCartItemForLaterAction,
  updateCartItemQtyAction,
} from "@/modules/cart/cart.actions";
import type { CartSummaryDTO } from "@/modules/cart/cart.service";
import type { CheckoutQuoteDTO } from "@/modules/orders/checkout-quote";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface CartPageClientProps {
  initialCart: CartSummaryDTO;
  initialQuote: CheckoutQuoteDTO | null;
  supportedCountries: string[];
}

export function CartPageClient({
  initialCart,
  initialQuote,
  supportedCountries,
}: CartPageClientProps) {
  const { currency, formatPrice } = useCurrency();
  const reducedMotion = useReducedMotionSafe();
  const [cart, setCart] = React.useState(initialCart);
  const [quote, setQuote] = React.useState<CheckoutQuoteDTO | null>(initialQuote);
  const [selectedCountry, setSelectedCountry] = React.useState(
    initialQuote?.shippingCountry ?? supportedCountries[0] ?? "US",
  );
  const [busyVariantId, setBusyVariantId] = React.useState<string | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);

  React.useEffect(() => {
    visitorStore.setLatestCart(initialCart);
  }, [initialCart]);

  const refreshQuote = React.useCallback(
    async (country: string, currencyCode: string = currency.code) => {
      setIsEstimating(true);
      const res = await estimateCartQuoteAction({
        shippingCountry: country,
        currency: currencyCode,
      });
      setIsEstimating(false);
      if (res.ok) {
        setQuote(res.data);
      }
    },
    [currency.code],
  );

  React.useEffect(() => {
    if (cart.items.length === 0) return;
    if (quote?.currency === currency.code) return;
    let active = true;
    void estimateCartQuoteAction({
      shippingCountry: selectedCountry,
      currency: currency.code,
    }).then((res) => {
      if (!active) return;
      if (res.ok) {
        setQuote(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, [cart.items.length, currency.code, quote?.currency, selectedCountry]);

  async function handleQuantityChange(variantId: string, nextQty: number, cartItemId?: string) {
    setBusyVariantId(cartItemId ?? variantId);
    const result = await updateCartItemQtyAction({ variantId, cartItemId, quantity: nextQty });
    setBusyVariantId(null);

    if (!result.ok) {
      void notifyError(result.error.message);
      return;
    }

    setCart(result.data);
    visitorStore.setLatestCart(result.data);
    await refreshQuote(selectedCountry);
  }

  async function handleRemove(variantId: string, name: string, cartItemId?: string) {
    setBusyVariantId(cartItemId ?? variantId);
    const result = await removeCartItemAction({ variantId, cartItemId });
    setBusyVariantId(null);

    if (!result.ok) {
      void notifyError(result.error.message);
      return;
    }

    const updatedItems = cart.items.filter((item) =>
      cartItemId ? item.id !== cartItemId : item.variantId !== variantId,
    );
    const updatedCart = {
      ...cart,
      itemCount: result.data.itemCount,
      subtotal: result.data.subtotal,
      items: updatedItems,
    };
    setCart(updatedCart);
    visitorStore.setLatestCart(updatedCart);
    void notifySuccess(`${name} removed from your bag.`);
    if (updatedItems.length > 0) {
      await refreshQuote(selectedCountry);
    } else {
      setQuote(null);
    }
  }

  async function handleSaveForLater(variantId: string, name: string, cartItemId?: string) {
    setBusyVariantId(cartItemId ?? variantId);
    const result = await saveCartItemForLaterAction({ variantId, cartItemId });
    setBusyVariantId(null);

    if (!result.ok) {
      void notifyError(result.error.message);
      return;
    }

    setCart(result.data.cart);
    visitorStore.setLatestCart(result.data.cart);
    visitorStore.setWishlistVariantIds(result.data.wishlistVariantIds);
    void notifySuccess(`${name} moved to your saved wishlist.`);
    if (result.data.cart.items.length > 0) {
      await refreshQuote(selectedCountry);
    } else {
      setQuote(null);
    }
  }

  async function handleCountryChange(nextCountry: string) {
    setSelectedCountry(nextCountry);
    await refreshQuote(nextCountry);
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your Shopping Bag Is Empty"
        description="Select any ready-to-ship piece from our collections to prepare an insured studio order."
        actionLabel="Browse Collections"
        actionHref="/collections"
      />
    );
  }

  const hasPriceUpdates = cart.items.some((i) => i.hasPriceChanged);
  const hasStockIssues = cart.items.some((i) => i.hasStockIssue || i.availableStock <= 0);
  const outOfStockItems = cart.items.some((i) => i.availableStock <= 0);

  const activeQuote = quote && quote.currency === currency.code ? quote : null;

  let progressPct = 100;
  if (activeQuote?.freeShippingThreshold) {
    const thresholdNum = Number(activeQuote.freeShippingThreshold);
    const subtotalNum = Number(activeQuote.subtotal);
    if (thresholdNum > 0) {
      progressPct = Math.min(100, Math.max(0, Math.round((subtotalNum / thresholdNum) * 100)));
    }
  }

  return (
    <div className="space-y-6">
      {(hasPriceUpdates || hasStockIssues) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-warning"
            aria-hidden="true"
          />
          <div className="space-y-1">
            {hasPriceUpdates && (
              <p className="font-medium text-foreground">
                Prices for some items in your bag have been updated.
              </p>
            )}
            {hasStockIssues && (
              <p className="text-muted-foreground">
                Vault availability changed for an item in your bag. Please adjust or remove
                unavailable pieces before checkout.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-4 lg:col-span-8">
          <AnimatePresence initial={false}>
            {cart.items.map((item, itemIndex) => {
              const busy = busyVariantId === item.id || busyVariantId === item.variantId;
              const isSeedImage = item.imageUrl?.startsWith("/images/seed/") ?? false;
              const formattedLineTotal = formatPrice(item.lineTotal, { exact: true });
              return (
                <m.div
                  key={item.id}
                  variants={staggerItemVariants}
                  initial={false}
                  exit={
                    reducedMotion
                      ? { opacity: 0, transition: MOTION_TRANSITIONS.reduced }
                      : { opacity: 0, scale: 0.97, y: -6, transition: MOTION_TRANSITIONS.fast }
                  }
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5"
                >
                  <div className="flex items-start gap-3 sm:contents">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="ma-media-placeholder relative size-[72px] shrink-0 overflow-hidden rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:size-24"
                    >
                      {item.imageUrl ? (
                        <Image
                          loading={itemIndex === 0 ? "eager" : "lazy"}
                          src={item.imageUrl}
                          alt={item.imageAltText ?? item.productName}
                          fill
                          sizes="96px"
                          className={
                            isSeedImage
                              ? "object-cover object-center dark:brightness-90"
                              : "object-cover object-center"
                          }
                        />
                      ) : null}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="line-clamp-2 text-base leading-[1.35] font-semibold text-foreground sm:text-lg">
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="rounded-sm underline-offset-4 hover:text-accent-text hover:underline"
                        >
                          {item.productName}
                        </Link>
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.variantTitle} · SKU {item.variantSku}
                      </p>
                      {item.isCustomized ? (
                        <CustomizedSpecsBadge
                          requestId={item.customizationRequestId}
                          requestNumber={item.customizationRequestNumber}
                          summaryLines={item.customizationSummaryLines}
                        />
                      ) : null}
                      <Price amount={item.unitPrice} currency={cart.currency} size="sm" />
                      {item.availableStock <= 0 ? (
                        <p className="pt-0.5 text-xs font-medium text-destructive">
                          Sold out — remove it to continue
                        </p>
                      ) : item.hasStockIssue ? (
                        <p className="pt-0.5 text-xs font-medium text-destructive">
                          Only {item.availableStock} left — reduce the quantity to continue
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 sm:justify-end sm:gap-4 sm:border-t-0 sm:pt-0">
                    {item.isCustomized ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        Custom piece · Qty 1
                      </span>
                    ) : (
                      <QuantityStepper
                        value={item.quantity}
                        min={1}
                        max={Math.min(10, Math.max(1, item.availableStock))}
                        disabled={busy || item.availableStock <= 0}
                        onChange={(next) => handleQuantityChange(item.variantId, next, item.id)}
                      />
                    )}

                    <div className="text-right">
                      <p className="tabular-nums-price text-base font-semibold text-foreground sm:text-lg">
                        <AnimatedCounter value={formattedLineTotal} />
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleSaveForLater(item.variantId, item.productName, item.id)
                          }
                          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-muted transition-colors duration-150 ease-out hover:text-accent-text focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Bookmark className="size-4" strokeWidth={1.5} aria-hidden="true" />
                          <span>Save for later</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRemove(item.variantId, item.productName, item.id)}
                          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-muted transition-colors duration-150 ease-out hover:text-destructive focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>

        <aside className="lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-6 lg:sticky lg:top-24">
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
              Order Summary
            </h2>

            {activeQuote?.freeShippingThreshold && (
              <div className="mt-4 rounded-md border border-border bg-surface-2 p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {activeQuote.isFreeShipping ? (
                    <>
                      <CheckCircle2
                        className="size-5 shrink-0 stroke-[1.5] text-success"
                        aria-hidden="true"
                      />
                      <span>You qualify for complimentary insured shipping</span>
                    </>
                  ) : (
                    <span>
                      Add{" "}
                      <strong className="tabular-nums-price font-semibold">
                        {formatMoneyExact(
                          activeQuote.amountToFreeShipping ?? "0.00",
                          activeQuote.currency,
                          "en-US",
                          activeQuote.currencyDecimals,
                        )}
                      </strong>{" "}
                      more for complimentary insured express shipping
                    </span>
                  )}
                </div>
                <div
                  className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border"
                  aria-hidden="true"
                >
                  <div
                    className="ma-progress-fill h-full w-full bg-accent"
                    style={{ transform: `scaleX(${progressPct / 100})` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label
                htmlFor="cart-estimate-country"
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Estimate Shipping Destination
              </label>
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger id="cart-estimate-country" className="h-12 bg-background md:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedCountries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {formatCountryName(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Items ({cart.itemCount})</dt>
                <dd className="tabular-nums-price font-medium text-foreground">
                  <AnimatedCounter
                    value={
                      activeQuote
                        ? formatMoneyExact(
                            activeQuote.subtotal,
                            activeQuote.currency,
                            "en-US",
                            activeQuote.currencyDecimals,
                          )
                        : formatPrice(cart.subtotal, { exact: true })
                    }
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  {activeQuote ? activeQuote.selectedZone.name : "Insured Delivery"}
                </dt>
                <dd className="tabular-nums-price font-medium text-foreground">
                  {isEstimating
                    ? "Calculating…"
                    : activeQuote
                      ? activeQuote.isFreeShipping
                        ? "Complimentary"
                        : formatMoneyExact(
                            activeQuote.shippingCost,
                            activeQuote.currency,
                            "en-US",
                            activeQuote.currencyDecimals,
                          )
                      : "Calculated at checkout"}
                </dd>
              </div>
              {activeQuote && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {activeQuote.taxLabel}
                    {activeQuote.taxInclusive ? " (Included)" : ""}
                  </dt>
                  <dd className="tabular-nums-price font-medium text-foreground">
                    {formatMoneyExact(
                      activeQuote.taxAmount,
                      activeQuote.currency,
                      "en-US",
                      activeQuote.currencyDecimals,
                    )}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <dt className="text-base font-semibold text-foreground">Estimated Total</dt>
                <dd className="tabular-nums-price text-xl font-semibold text-foreground">
                  <AnimatedCounter
                    value={
                      activeQuote
                        ? formatMoneyExact(
                            activeQuote.total,
                            activeQuote.currency,
                            "en-US",
                            activeQuote.currencyDecimals,
                          )
                        : formatPrice(cart.subtotal, { exact: true })
                    }
                  />
                </dd>
              </div>
            </dl>

            {(quote?.signatureRequired ?? cart.signatureRequired) && (
              <p className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                  aria-hidden="true"
                />
                <span>
                  Adult signature verification is included automatically for insured security on
                  this order.
                </span>
              </p>
            )}

            <div className="mt-6 space-y-2.5">
              {outOfStockItems || hasStockIssues ? (
                <Button type="button" size="lg" className="w-full" disabled>
                  Resolve Stock Notice to Checkout
                </Button>
              ) : (
                <Button asChild size="lg" className="w-full">
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/collections">Continue Exploring</Link>
              </Button>
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Need help choosing?{" "}
                <Link
                  href="/contact?type=PRODUCT"
                  className="inline-flex min-h-11 items-center font-medium text-accent-text underline underline-offset-4"
                >
                  Contact us
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
