"use client";

import * as React from "react";

const STORAGE_KEY = "atelier_recently_viewed_ids";
const RECENTLY_VIEWED_EVENT = "atelier:recently-viewed-updated";
const MAX_RECENTLY_VIEWED = 12;

function parseRecentlyViewedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, MAX_RECENTLY_VIEWED);
  } catch {
    return [];
  }
}

export function readRecentlyViewedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseRecentlyViewedIds(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function recordRecentlyViewedId(productId: string): string[] {
  if (typeof window === "undefined" || !productId.trim()) return [];
  const normalized = productId.trim();
  const next = [normalized, ...readRecentlyViewedIds().filter((id) => id !== normalized)].slice(
    0,
    MAX_RECENTLY_VIEWED,
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
  } catch {
    // Ignore quota / privacy-mode storage errors
  }
  return next;
}

function subscribeRecentlyViewed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECENTLY_VIEWED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECENTLY_VIEWED_EVENT, callback);
  };
}

function getRawRecentlyViewedSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

export function useRecentlyViewedIds(excludeProductId?: string): string[] {
  const raw = React.useSyncExternalStore(
    subscribeRecentlyViewed,
    getRawRecentlyViewedSnapshot,
    getServerSnapshot,
  );

  return React.useMemo(() => {
    const all = parseRecentlyViewedIds(raw);
    return excludeProductId ? all.filter((id) => id !== excludeProductId) : all;
  }, [raw, excludeProductId]);
}
