"use client";

import * as React from "react";

/**
 * Debounced, cached, race-free search suggestions for the header search and the home finder.
 *
 * - Results are always tied to the query that produced them, so an older/slower response can
 *   never overwrite a newer one, and stale results are never shown for a different query.
 * - Responses are kept in a small in-memory cache, so retyping or going back to a query is instant.
 * - Failures (offline, rate limited) surface as `status: "error"` with `retry()` instead of the
 *   dropdown silently showing nothing.
 */

export interface SuggestProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  categoryName: string;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  imageUrl: string | null;
  altText: string | null;
}

export interface SuggestCategory {
  id: string;
  name: string;
  path: string;
  productCount: number;
}

export interface SuggestGuide {
  id: string;
  title: string;
  slug: string;
  authorName: string;
}

export interface SuggestResponse {
  query: string;
  categories: SuggestCategory[];
  products: SuggestProduct[];
  guides?: SuggestGuide[];
}

export type SuggestStatus = "idle" | "loading" | "success" | "error";

const CACHE_LIMIT = 40;
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: SuggestResponse; at: number }>();
const inflight = new Map<string, Promise<SuggestResponse>>();

function cacheKey(query: string, limit: number) {
  return `${limit}:${query.toLowerCase()}`;
}

function readCache(key: string): SuggestResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function fetchSuggestions(query: string, limit: number): Promise<SuggestResponse> {
  const key = cacheKey(query, limit);
  const existing = inflight.get(key);
  if (existing) return existing;
  // Not tied to a component's AbortController: a shared request finishes and fills the cache
  // even if the user kept typing, so coming back to this query is instant.
  const request = fetch(`/api/search/suggest?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: { accept: "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Suggestions failed (${res.status})`);
      const data = (await res.json()) as SuggestResponse;
      cache.set(key, { data, at: Date.now() });
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

interface State {
  query: string;
  status: SuggestStatus;
  data: SuggestResponse | null;
}

export function useSearchSuggestions(
  rawQuery: string,
  { limit = 6, minLength = 2, enabled = true, debounceMs = 150 } = {},
) {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  const active = enabled && query.length >= minLength;
  const [state, setState] = React.useState<State>({ query: "", status: "idle", data: null });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    const cached = readCache(cacheKey(query, limit));
    let cancelled = false;
    if (cached) {
      // Cache hit: show immediately, no debounce.
      queueMicrotask(() => {
        if (!cancelled) setState({ query, status: "success", data: cached });
      });
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(() => {
      setState((prev) => ({ query, status: "loading", data: prev.data }));
      fetchSuggestions(query, limit).then(
        (data) => {
          if (!cancelled) setState({ query, status: "success", data });
        },
        () => {
          if (!cancelled) setState({ query, status: "error", data: null });
        },
      );
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, query, limit, debounceMs, attempt]);

  const retry = React.useCallback(() => setAttempt((n) => n + 1), []);

  if (!active) return { query, status: "idle" as SuggestStatus, data: null, retry };
  const isCurrent = state.query === query;
  return {
    query,
    // Until the debounce fires for a new query we're effectively loading.
    status: isCurrent ? state.status : ("loading" as SuggestStatus),
    data: isCurrent && state.status === "success" ? state.data : null,
    retry,
  };
}
