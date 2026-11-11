"use client";

import * as React from "react";

export interface VisitorSnapshot {
  hydrated: boolean;
  wishlistVariantIds: string[];
  bagCount: number;
}

const SERVER_SNAPSHOT: VisitorSnapshot = {
  hydrated: false,
  wishlistVariantIds: [],
  bagCount: 0,
};

let currentSnapshot: VisitorSnapshot = {
  hydrated: false,
  wishlistVariantIds: [],
  bagCount: 0,
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
};

export function useVisitorState(): VisitorSnapshot {
  return React.useSyncExternalStore(
    visitorStore.subscribe,
    visitorStore.getSnapshot,
    visitorStore.getServerSnapshot,
  );
}
