"use client";

import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { useVisitorState } from "@/modules/storefront/visitor-store";

export function HeaderWishlistAction({ initialCount }: { initialCount: number }) {
  const visitor = useVisitorState();
  const count = visitor.hydrated ? visitor.wishlistVariantIds.length : initialCount;

  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist (${count} saved items)`}
      className="relative inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Heart className="size-4" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-foreground tabular-nums-price"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

export function HeaderCartAction({ initialCount }: { initialCount: number }) {
  const visitor = useVisitorState();
  const count = visitor.hydrated ? visitor.bagCount : initialCount;

  return (
    <Link
      href="/cart"
      aria-label={`Shopping bag (${count} items)`}
      className="relative inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ShoppingBag className="size-4" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums-price"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
