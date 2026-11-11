"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVisitorState, visitorStore } from "@/modules/storefront/visitor-store";
import { toggleWishlistAction } from "@/modules/wishlist/wishlist.actions";

interface WishlistToggleButtonProps {
  variantId: string | null;
  productName: string;
  mode?: "icon" | "button";
  className?: string;
}

export function WishlistToggleButton({
  variantId,
  productName,
  mode = "icon",
  className,
}: WishlistToggleButtonProps) {
  const state = useVisitorState();
  const [pending, setPending] = React.useState(false);

  if (!variantId) return null;

  const isSaved = state.wishlistVariantIds.includes(variantId);

  async function handleToggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!variantId || pending) return;

    const previousIds = [...state.wishlistVariantIds];
    setPending(true);
    const optimisticSaved = visitorStore.toggleWishlistOptimistic(variantId);

    const result = await toggleWishlistAction({ variantId });
    setPending(false);

    if (!result.ok) {
      visitorStore.setWishlistVariantIds(previousIds);
      toast.error(result.error.message);
      return;
    }

    visitorStore.setWishlistVariantIds(result.data.variantIds);
    toast.success(
      optimisticSaved
        ? `${productName} added to your saved pieces.`
        : `${productName} removed from your saved pieces.`,
    );
  }

  if (mode === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-pressed={isSaved}
        disabled={pending}
        onClick={handleToggle}
        className={cn("gap-2", className)}
      >
        <Heart
          className={cn("size-4", isSaved ? "fill-accent text-accent" : "text-foreground")}
          aria-hidden="true"
        />
        <span>{isSaved ? "Saved in Wishlist" : "Save to Wishlist"}</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={isSaved}
      aria-label={
        isSaved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`
      }
      className={cn(
        "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-border/80 bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-accent hover:bg-card focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Heart
        className={cn("size-4 transition-colors", isSaved ? "fill-accent text-accent" : "")}
        aria-hidden="true"
      />
    </button>
  );
}
