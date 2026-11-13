"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Heart, ShoppingBag, User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReducedMotionSafe } from "@/lib/motion";
import {
  useBagCount,
  useCartDrawerMounted,
  useVisitorHydrated,
  useWishlistCount,
  visitorStore,
} from "@/modules/storefront/visitor-store";

const DynamicCartDrawer = dynamic(
  () => import("@/components/storefront/CartDrawer").then((mod) => mod.CartDrawer),
  { ssr: false },
);

export function HeaderWishlistAction({ initialCount }: { initialCount: number }) {
  const hydrated = useVisitorHydrated();
  const count = useWishlistCount(initialCount);
  const reducedMotion = useReducedMotionSafe();
  const iconRef = React.useRef<HTMLSpanElement | null>(null);
  const prevCountRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!hydrated) return;
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (prev !== null && count > prev && !reducedMotion && iconRef.current?.animate) {
      iconRef.current.animate(
        [
          { transform: "scale3d(0.85, 0.85, 1)" },
          { transform: "scale3d(1.18, 1.18, 1)" },
          { transform: "scale3d(1, 1, 1)" },
        ],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, [count, hydrated, reducedMotion]);

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/wishlist"
            aria-label={`Wishlist (${count} saved items)`}
            className="transition-ui relative hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
          >
            <span ref={iconRef} className="inline-flex">
              <Heart className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </span>
            {count > 0 && (
              <span
                key={count}
                aria-hidden="true"
                className="ma-badge-pop tabular-nums-price absolute top-0.5 right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-on-accent"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent className="hidden lg:block">Wishlist</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function HeaderCartAction({ initialCount }: { initialCount: number }) {
  const hydrated = useVisitorHydrated();
  const count = useBagCount(initialCount);
  const cartDrawerMounted = useCartDrawerMounted();
  const reducedMotion = useReducedMotionSafe();
  const iconRef = React.useRef<HTMLSpanElement | null>(null);
  const prevCountRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!hydrated) return;
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (
      prev !== null &&
      count !== prev &&
      count > 0 &&
      !reducedMotion &&
      iconRef.current?.animate
    ) {
      iconRef.current.animate(
        [
          { transform: "scale3d(1, 1, 1)" },
          { transform: "scale3d(1.16, 1.16, 1)" },
          { transform: "scale3d(1, 1, 1)" },
        ],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, [count, hydrated, reducedMotion]);

  return (
    <>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/cart"
              data-cart-bag-target="true"
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  visitorStore.openCartDrawer();
                }
              }}
              aria-label={`Shopping bag (${count} items)`}
              className="transition-ui relative inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span ref={iconRef} className="inline-flex">
                <ShoppingBag className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </span>
              {count > 0 && (
                <span
                  key={count}
                  aria-hidden="true"
                  className="ma-badge-pop tabular-nums-price absolute top-0.5 right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-on-accent"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent className="hidden lg:block">Shopping bag</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {cartDrawerMounted ? <DynamicCartDrawer /> : null}
    </>
  );
}

export function HeaderAccountAction({ href, label }: { href: string; label: string }) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            aria-label={label}
            className="transition-ui hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
          >
            <User className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent className="hidden lg:block">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
