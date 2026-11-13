"use client";

import * as React from "react";
import type { CartSummaryDTO } from "@/modules/cart/cart.service";

export interface VisitorSnapshot {
  hydrated: boolean;
  wishlistVariantIds: string[];
  bagCount: number;
  cartDrawerOpen: boolean;
  cartDrawerMounted: boolean;
  latestCart: CartSummaryDTO | null;
}

const SERVER_SNAPSHOT: VisitorSnapshot = {
  hydrated: false,
  wishlistVariantIds: [],
  bagCount: 0,
  cartDrawerOpen: false,
  cartDrawerMounted: false,
  latestCart: null,
};

let currentSnapshot: VisitorSnapshot = {
  hydrated: false,
  wishlistVariantIds: [],
  bagCount: 0,
  cartDrawerOpen: false,
  cartDrawerMounted: false,
  latestCart: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const visitorStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): VisitorSnapshot {
    return currentSnapshot;
  },
  getServerSnapshot(): VisitorSnapshot {
    return SERVER_SNAPSHOT;
  },
  hydrate(wishlistVariantIds: string[], bagCount: number) {
    const sameWishlist =
      currentSnapshot.wishlistVariantIds.length === wishlistVariantIds.length &&
      currentSnapshot.wishlistVariantIds.every((id, idx) => id === wishlistVariantIds[idx]);
    if (currentSnapshot.hydrated && sameWishlist && currentSnapshot.bagCount === bagCount) {
      return;
    }
    currentSnapshot = {
      ...currentSnapshot,
      hydrated: true,
      wishlistVariantIds: [...wishlistVariantIds],
      bagCount,
    };
    emitChange();
  },
  setWishlistVariantIds(variantIds: string[]) {
    currentSnapshot = {
      ...currentSnapshot,
      hydrated: true,
      wishlistVariantIds: [...variantIds],
    };
    emitChange();
  },
  toggleWishlistOptimistic(variantId: string) {
    const exists = currentSnapshot.wishlistVariantIds.includes(variantId);
    const nextIds = exists
      ? currentSnapshot.wishlistVariantIds.filter((id) => id !== variantId)
      : [...currentSnapshot.wishlistVariantIds, variantId];
    currentSnapshot = {
      ...currentSnapshot,
      hydrated: true,
      wishlistVariantIds: nextIds,
    };
    emitChange();
    return !exists;
  },
  setBagCount(bagCount: number) {
    currentSnapshot = {
      ...currentSnapshot,
      hydrated: true,
      bagCount: Math.max(0, bagCount),
    };
    emitChange();
  },
  setLatestCart(cart: CartSummaryDTO | null) {
    currentSnapshot = {
      ...currentSnapshot,
      hydrated: true,
      latestCart: cart,
      bagCount: cart ? cart.itemCount : currentSnapshot.bagCount,
    };
    emitChange();
  },
  openCartDrawer() {
    currentSnapshot = {
      ...currentSnapshot,
      cartDrawerOpen: true,
      cartDrawerMounted: true,
    };
    emitChange();
  },
  closeCartDrawer() {
    if (!currentSnapshot.cartDrawerOpen) return;
    currentSnapshot = {
      ...currentSnapshot,
      cartDrawerOpen: false,
    };
    emitChange();
  },
  setCartDrawerOpen(open: boolean) {
    if (currentSnapshot.cartDrawerOpen === open && (!open || currentSnapshot.cartDrawerMounted)) {
      return;
    }
    currentSnapshot = {
      ...currentSnapshot,
      cartDrawerOpen: open,
      cartDrawerMounted: open ? true : currentSnapshot.cartDrawerMounted,
    };
    emitChange();
  },
};

export function useVisitorState(): VisitorSnapshot {
  return React.useSyncExternalStore(
    visitorStore.subscribe,
    visitorStore.getSnapshot,
    visitorStore.getServerSnapshot,
  );
}

const subscribeVisitor = visitorStore.subscribe;

export function useVisitorHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeVisitor,
    () => visitorStore.getSnapshot().hydrated,
    () => false,
  );
}

export function useIsWishlisted(variantId: string | null): boolean {
  return React.useSyncExternalStore(
    subscribeVisitor,
    () => {
      if (!variantId) return false;
      return visitorStore.getSnapshot().wishlistVariantIds.includes(variantId);
    },
    () => false,
  );
}

export function useWishlistCount(initialCount: number): number {
  return React.useSyncExternalStore(
    subscribeVisitor,
    () => {
      const snap = visitorStore.getSnapshot();
      return snap.hydrated ? snap.wishlistVariantIds.length : initialCount;
    },
    () => initialCount,
  );
}

export function useBagCount(initialCount: number): number {
  return React.useSyncExternalStore(
    subscribeVisitor,
    () => {
      const snap = visitorStore.getSnapshot();
      return snap.hydrated ? snap.bagCount : initialCount;
    },
    () => initialCount,
  );
}

export function useCartDrawerMounted(): boolean {
  return React.useSyncExternalStore(
    subscribeVisitor,
    () => visitorStore.getSnapshot().cartDrawerMounted,
    () => false,
  );
}
