"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { Heart } from "lucide-react";
import { m } from "motion/react";
import { Button } from "@/components/ui/button";
import { useReducedMotionSafe } from "@/lib/motion";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useIsWishlisted, visitorStore } from "@/modules/storefront/visitor-store";
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
  const ui = useUiText();
  const isSaved = useIsWishlisted(variantId);
  const [pending, setPending] = React.useState(false);
  const [pulseKey, setPulseKey] = React.useState(0);
  const reducedMotion = useReducedMotionSafe();

  if (!variantId) return null;

  async function handleToggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!variantId || pending) return;

    const previousIds = [...visitorStore.getSnapshot().wishlistVariantIds];
    setPending(true);
    setPulseKey((k) => k + 1);
    const optimisticSaved = visitorStore.toggleWishlistOptimistic(variantId);

    const result = await toggleWishlistAction({ variantId });
    setPending(false);

    if (!result.ok) {
      visitorStore.setWishlistVariantIds(previousIds);
      void notifyError(result.error.message);
      return;
    }

    visitorStore.setWishlistVariantIds(result.data.variantIds);
    void notifySuccess(
      optimisticSaved
        ? fill(ui.productCard.savedToast, { name: productName })
        : fill(ui.productCard.removedToast, { name: productName }),
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
        <m.span
          key={pulseKey}
          initial={pulseKey > 0 && !reducedMotion ? { scale: 0.8 } : false}
          animate={pulseKey > 0 && !reducedMotion ? { scale: [0.8, 1.18, 1] } : undefined}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <Heart
            className={cn(
              "size-5 transition-colors duration-200",
              isSaved
                ? "fill-accent-hover text-accent-hover dark:fill-accent dark:text-accent"
                : "text-text",
            )}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </m.span>
        <span>{isSaved ? ui.productCard.savedInWishlist : ui.productCard.saveToWishlist}</span>
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
        isSaved
          ? fill(ui.productCard.removeWishlistAria, { name: productName })
          : fill(ui.productCard.saveWishlistAria, { name: productName })
      }
      className={cn(
        "group/wish inline-flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <span
        className={cn(
          "transition-ui inline-flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm group-active/wish:scale-95",
          isSaved
            ? "border-accent bg-accent text-on-accent"
            : "border-border-strong bg-surface/95 text-text group-hover/wish:border-accent group-hover/wish:bg-surface",
        )}
      >
        <m.span
          key={pulseKey}
          initial={pulseKey > 0 && !reducedMotion ? { scale: 0.8 } : false}
          animate={pulseKey > 0 && !reducedMotion ? { scale: [0.8, 1.18, 1] } : undefined}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <Heart
            className={cn(
              "size-[18px] transition-colors duration-200",
              isSaved ? "fill-current" : "",
            )}
            strokeWidth={1.65}
            aria-hidden="true"
          />
        </m.span>
      </span>
    </button>
  );
}
