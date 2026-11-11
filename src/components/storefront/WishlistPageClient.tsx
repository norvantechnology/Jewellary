"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "@/modules/cart/cart.actions";
import { visitorStore } from "@/modules/storefront/visitor-store";
import { removeWishlistItemAction } from "@/modules/wishlist/wishlist.actions";
import type { WishlistItemDTO } from "@/modules/wishlist/wishlist.service";

interface WishlistPageClientProps {
  initialItems: WishlistItemDTO[];
  currency: string;
}

export function WishlistPageClient({ initialItems, currency }: WishlistPageClientProps) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleRemove(variantId: string) {
    setPendingId(variantId);
    const result = await removeWishlistItemAction({ variantId });
    setPendingId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    visitorStore.setWishlistVariantIds(result.data.variantIds);
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
    toast.success("Piece removed from your wishlist.");
  }

  async function handleMoveToBag(item: WishlistItemDTO) {
    if (item.priceMode !== "FIXED" || item.availableStock <= 0) return;

    setPendingId(item.variantId);
    const result = await addToCartAction({ variantId: item.variantId, quantity: 1 });
    setPendingId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    visitorStore.setBagCount(result.data.itemCount);
    toast.success(`${item.productName} added to your bag.`, {
      action: {
        label: "View Bag",
        onClick: () => router.push("/cart"),
      },
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your Saved Pieces Collection Is Empty"
        description="Explore our rings, necklaces, earrings, and bracelets to bookmark pieces while you compare metals and grading certificates."
        actionLabel="Explore Jewellery"
        actionHref="/collections"
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const busy = pendingId === item.variantId;
        return (
          <article
            key={item.id}
            className="flex flex-col overflow-hidden rounded-md border border-border bg-card"
          >
            <Link
              href={`/products/${item.productSlug}`}
              className="relative aspect-[4/5] w-full bg-muted"
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.imageAltText ?? item.productName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : null}
            </Link>

            <div className="flex flex-1 flex-col justify-between gap-4 p-4">
              <div>
                <h2 className="font-display text-xl font-medium text-foreground">
                  <Link href={`/products/${item.productSlug}`} className="hover:underline">
                    {item.productName}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.variantTitle}
                  {item.caratTotal ? ` · ${item.caratTotal} ct` : ""}
                </p>
                <div className="mt-2">
                  <Price
                    amount={item.price}
                    compareAtAmount={item.compareAtPrice}
                    currency={currency}
                    isPriceOnRequest={item.priceMode === "PRICE_ON_REQUEST"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-3">
                {item.priceMode === "FIXED" && item.availableStock > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleMoveToBag(item)}
                    className="flex-1 gap-1.5"
                  >
                    <ShoppingBag className="size-3.5" aria-hidden="true" />
                    <span>Add to Bag</span>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link
                      href={`/contact?type=BESPOKE&product=${encodeURIComponent(item.productName)}`}
                    >
                      Enquire
                    </Link>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Remove ${item.productName} from wishlist`}
                  onClick={() => handleRemove(item.variantId)}
                >
                  <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
