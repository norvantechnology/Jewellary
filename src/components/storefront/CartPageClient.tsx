"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Price } from "@/components/shared/Price";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { Button } from "@/components/ui/button";
import { formatMoneyExact } from "@/lib/money";
import { removeCartItemAction, updateCartItemQtyAction } from "@/modules/cart/cart.actions";
import type { CartSummaryDTO } from "@/modules/cart/cart.service";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface CartPageClientProps {
  initialCart: CartSummaryDTO;
}

export function CartPageClient({ initialCart }: CartPageClientProps) {
  const [cart, setCart] = React.useState(initialCart);
  const [busyVariantId, setBusyVariantId] = React.useState<string | null>(null);

  React.useEffect(() => {
    visitorStore.setBagCount(initialCart.itemCount);
  }, [initialCart.itemCount]);

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

  return (
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
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <QuantityStepper
                  value={item.quantity}
                  min={1}
                  max={Math.min(10, Math.max(1, item.availableStock))}
                  disabled={busy}
                  onChange={(next) => handleQuantityChange(item.variantId, next)}
                />

                <div className="text-right">
                  <p className="text-sm font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(item.lineTotal, cart.currency)}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(item.variantId, item.productName)}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <aside className="lg:col-span-4">
        <div className="rounded-md border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-medium text-foreground">Order Summary</h2>
          <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Items ({cart.itemCount})</dt>
              <dd className="font-medium text-foreground tabular-nums-price">
                {formatMoneyExact(cart.subtotal, cart.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shipping &amp; Tax</dt>
              <dd className="text-xs text-muted-foreground">
                Calculated at consultation / checkout
              </dd>
            </div>
          </dl>

          {cart.signatureRequired && (
            <p className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Adult signature verification is included automatically for insured security on this
                order.
              </span>
            </p>
          )}

          <div className="mt-6 space-y-2.5">
            <Button asChild size="lg" className="w-full">
              <Link href="/contact?type=PRODUCT">Request Private Purchase Concierge</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/collections">Continue Exploring</Link>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
