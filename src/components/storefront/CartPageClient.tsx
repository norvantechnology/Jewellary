"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
  const [cart, setCart] = React.useState(initialCart);
  const [quote, setQuote] = React.useState<CheckoutQuoteDTO | null>(initialQuote);
  const [selectedCountry, setSelectedCountry] = React.useState(
    initialQuote?.shippingCountry ?? supportedCountries[0] ?? "US",
  );
  const [busyVariantId, setBusyVariantId] = React.useState<string | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);

  React.useEffect(() => {
    visitorStore.setBagCount(initialCart.itemCount);
  }, [initialCart.itemCount]);

  const refreshQuote = React.useCallback(async (country: string) => {
    setIsEstimating(true);
    const res = await estimateCartQuoteAction({ shippingCountry: country });
    setIsEstimating(false);
    if (res.ok) {
      setQuote(res.data);
    }
  }, []);

  async function handleQuantityChange(variantId: string, nextQty: number) {
    setBusyVariantId(variantId);
    const result = await updateCartItemQtyAction({ variantId, quantity: nextQty });
    setBusyVariantId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setCart(result.data);
    visitorStore.setBagCount(result.data.itemCount);
    await refreshQuote(selectedCountry);
  }

  async function handleRemove(variantId: string, name: string) {
    setBusyVariantId(variantId);
    const result = await removeCartItemAction({ variantId });
    setBusyVariantId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    const updatedItems = cart.items.filter((item) => item.variantId !== variantId);
    setCart({
      ...cart,
      itemCount: result.data.itemCount,
      subtotal: result.data.subtotal,
      items: updatedItems,
    });
    visitorStore.setBagCount(result.data.itemCount);
    toast.success(`${name} removed from your bag.`);
    if (updatedItems.length > 0) {
      await refreshQuote(selectedCountry);
    } else {
      setQuote(null);
    }
  }

  async function handleSaveForLater(variantId: string, name: string) {
    setBusyVariantId(variantId);
    const result = await saveCartItemForLaterAction({ variantId });
    setBusyVariantId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setCart(result.data.cart);
    visitorStore.setBagCount(result.data.cart.itemCount);
    visitorStore.setWishlistVariantIds(result.data.wishlistVariantIds);
    toast.success(`${name} moved to your saved wishlist.`);
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

  let progressPct = 100;
  if (quote?.freeShippingThreshold) {
    const thresholdNum = Number(quote.freeShippingThreshold);
    const subtotalNum = Number(cart.subtotal);
    if (thresholdNum > 0) {
      progressPct = Math.min(100, Math.max(0, Math.round((subtotalNum / thresholdNum) * 100)));
    }
  }

  return (
    <div className="space-y-6">
      {(hasPriceUpdates || hasStockIssues) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md border border-accent/40 bg-card p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="space-y-1">
            {hasPriceUpdates && (
              <p className="text-foreground">
                Pricing on one or more pieces in your bag was refreshed to current live atelier
                rates.
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

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {cart.items.map((item) => {
            const busy = busyVariantId === item.variantId;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/products/${item.productSlug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-sm border border-border bg-muted"
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.imageAltText ?? item.productName}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : null}
                </Link>

                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-display text-xl font-medium text-foreground">
                    <Link href={`/products/${item.productSlug}`} className="hover:underline">
                      {item.productName}
                    </Link>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {item.variantTitle} · SKU {item.variantSku}
                  </p>
                  <Price amount={item.unitPrice} currency={cart.currency} size="sm" />
                  {item.availableStock <= 0 ? (
                    <p className="text-xs font-medium text-destructive">
                      Currently sold out in vault — remove or save for later
                    </p>
                  ) : item.hasStockIssue ? (
                    <p className="text-xs font-medium text-destructive">
                      Only {item.availableStock} left in vault — reduce quantity to proceed
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={Math.min(10, Math.max(1, item.availableStock))}
                    disabled={busy || item.availableStock <= 0}
                    onChange={(next) => handleQuantityChange(item.variantId, next)}
                  />

                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground tabular-nums-price">
                      {formatMoneyExact(item.lineTotal, cart.currency)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveForLater(item.variantId, item.productName)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-accent-text"
                      >
                        <Bookmark className="size-3" aria-hidden="true" />
                        <span>Save for later</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(item.variantId, item.productName)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="lg:col-span-4">
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Order Summary</h2>

            {quote?.freeShippingThreshold && (
              <div className="mt-4 rounded-sm border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {quote.isFreeShipping ? (
                    <>
                      <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span>You qualify for complimentary insured shipping</span>
                    </>
                  ) : (
                    <span>
                      Add{" "}
                      <strong className="tabular-nums-price">
                        {formatMoneyExact(quote.amountToFreeShipping ?? "0.00", cart.currency)}
                      </strong>{" "}
                      more for complimentary insured express shipping
                    </span>
                  )}
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              <label
                htmlFor="cart-estimate-country"
                className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
              >
                Estimate Shipping Destination
              </label>
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger id="cart-estimate-country" className="bg-background">
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

            <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Items ({cart.itemCount})</dt>
                <dd className="font-medium text-foreground tabular-nums-price">
                  {formatMoneyExact(cart.subtotal, cart.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {quote ? quote.selectedZone.name : "Insured Delivery"}
                </dt>
                <dd className="font-medium text-foreground tabular-nums-price">
                  {isEstimating
                    ? "Calculating…"
                    : quote
                      ? quote.isFreeShipping
                        ? "Complimentary"
                        : formatMoneyExact(quote.shippingCost, cart.currency)
                      : "Calculated at checkout"}
                </dd>
              </div>
              {quote && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    {quote.taxLabel}
                    {quote.taxInclusive ? " (Included)" : ""}
                  </dt>
                  <dd className="font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(quote.taxAmount, cart.currency)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-base">
                <dt className="font-display text-lg font-medium text-foreground">
                  Estimated Total
                </dt>
                <dd className="font-display text-xl font-medium text-foreground tabular-nums-price">
                  {formatMoneyExact(quote ? quote.total : cart.subtotal, cart.currency)}
                </dd>
              </div>
            </dl>

            {(quote?.signatureRequired ?? cart.signatureRequired) && (
              <p className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
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
                Prefer bespoke assistance?{" "}
                <Link href="/contact?type=PRODUCT" className="text-accent-text underline">
                  Speak with Private Concierge
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
