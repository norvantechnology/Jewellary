"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import { Loader2, Search, ShoppingBag, X } from "lucide-react";
import { getCachedShareProducts, saveCachedShareProducts } from "@/lib/chat-client-cache";
import { formatMoneyExact } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChatRefSnapshotOrder,
  ChatRefSnapshotProduct,
  ChatRefSnapshotRequest,
} from "@/modules/chat/chat.service";

export interface ChatProductPickerProps {
  open: boolean;
  viewerRole: "CUSTOMER" | "ADMIN";
  isMobileSheet?: boolean;
  formatPrice: (usdAmount: number | string) => string;
  onSelectShare: (type: "PRODUCT" | "REQUEST" | "ORDER", refId: string, label: string) => void;
  onClose: () => void;
}

const ROW_HEIGHT = 60;
const OVERSCAN = 4;

export function ChatProductPicker({
  open,
  viewerRole,
  isMobileSheet = false,
  formatPrice,
  onSelectShare,
  onClose,
}: ChatProductPickerProps) {
  const ui = useUiText();
  const includeCustomer = viewerRole === "CUSTOMER";
  const defaultCacheKey = includeCustomer ? "default:1" : "default:0";

  const [tab, setTab] = React.useState<"PRODUCT" | "REQUEST" | "ORDER">("PRODUCT");
  const [query, setQuery] = React.useState("");
  const [products, setProducts] = React.useState<ChatRefSnapshotProduct[]>(
    () => getCachedShareProducts(defaultCacheKey)?.products ?? [],
  );
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    () => getCachedShareProducts(defaultCacheKey)?.nextCursor ?? null,
  );
  const [requests, setRequests] = React.useState<ChatRefSnapshotRequest[]>(
    () => getCachedShareProducts(defaultCacheKey)?.requests ?? [],
  );
  const [orders, setOrders] = React.useState<ChatRefSnapshotOrder[]>(
    () => getCachedShareProducts(defaultCacheKey)?.orders ?? [],
  );
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const listScrollRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(240);

  // Focus search input and capture viewport height after open paint
  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const cached = getCachedShareProducts(defaultCacheKey);
      if (cached && query.trim().length === 0) {
        setProducts(cached.products);
        setNextCursor(cached.nextCursor);
        setRequests(cached.requests);
        setOrders(cached.orders);
      }
      searchInputRef.current?.focus({ preventScroll: true });
      if (listScrollRef.current) {
        setViewportH(listScrollRef.current.clientHeight || 240);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCacheKey]);

  // Instant client filter when query length === 1 or cached query hits
  const trimmedQuery = query.trim();
  const baseCached = open ? getCachedShareProducts(defaultCacheKey) : null;
  const searchCacheKey =
    trimmedQuery.length === 0 ? defaultCacheKey : `q:${trimmedQuery.toLowerCase()}`;
  const exactHit = trimmedQuery.length >= 2 ? getCachedShareProducts(searchCacheKey) : null;

  const displayedProducts = React.useMemo(() => {
    if (trimmedQuery.length === 1 && baseCached) {
      const needle = trimmedQuery.toLowerCase();
      return baseCached.products.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.sku ?? "").toLowerCase().includes(needle) ||
          p.slug.toLowerCase().includes(needle),
      );
    }
    if (exactHit) return exactHit.products;
    return products;
  }, [trimmedQuery, baseCached, exactHit, products]);

  // Debounced server search (200ms) with AbortController
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length === 1 && getCachedShareProducts(defaultCacheKey)) {
      return;
    }
    if (trimmed.length >= 2 && getCachedShareProducts(searchCacheKey)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(products.length === 0);
        const url = `/api/chat/products?q=${encodeURIComponent(trimmed)}&limit=20&includeCustomer=${
          includeCustomer && trimmed.length === 0 ? "1" : "0"
        }`;
        fetch(url, { signal: controller.signal })
          .then((r) => r.json())
          .then(
            (json: {
              ok?: boolean;
              data?: {
                products?: ChatRefSnapshotProduct[];
                nextCursor?: string | null;
                requests?: ChatRefSnapshotRequest[];
                orders?: ChatRefSnapshotOrder[];
              };
            }) => {
              if (!json?.ok || !json.data) return;
              const nextList = json.data.products ?? [];
              const cursor = json.data.nextCursor ?? null;
              setProducts(nextList);
              setNextCursor(cursor);
              if (trimmed.length === 0 && includeCustomer) {
                setRequests(json.data.requests ?? []);
                setOrders(json.data.orders ?? []);
              }
              saveCachedShareProducts(searchCacheKey, {
                products: nextList,
                nextCursor: cursor,
                requests:
                  trimmed.length === 0 && includeCustomer
                    ? (json.data.requests ?? [])
                    : (baseCached?.requests ?? []),
                orders:
                  trimmed.length === 0 && includeCustomer
                    ? (json.data.orders ?? [])
                    : (baseCached?.orders ?? []),
              });
            },
          )
          .catch(() => undefined)
          .finally(() => {
            if (!controller.signal.aborted) {
              setLoading(false);
            }
          });
      },
      trimmed.length === 0 ? 0 : 200,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, defaultCacheKey, includeCustomer]);

  async function loadMoreProducts() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chat/products?q=${encodeURIComponent(query.trim())}&cursor=${encodeURIComponent(nextCursor)}&limit=20&includeCustomer=0`,
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { products?: ChatRefSnapshotProduct[]; nextCursor?: string | null };
      } | null;
      if (res.ok && json?.data) {
        const appended = json.data.products ?? [];
        setProducts((prev) => {
          const seen = new Set(prev.map((x) => x.productId));
          return [...prev, ...appended.filter((x) => !seen.has(x.productId))];
        });
        setNextCursor(json.data.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function handleListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    if (el.clientHeight !== viewportH) setViewportH(el.clientHeight);
    if (
      tab === "PRODUCT" &&
      nextCursor &&
      !loadingMore &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 72
    ) {
      void loadMoreProducts();
    }
  }

  if (!open) return null;

  // Virtual window for PRODUCT tab when > 24 rows
  const shouldVirtualize = tab === "PRODUCT" && displayedProducts.length > 24;
  const startIdx = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    : 0;
  const visibleCount = shouldVirtualize
    ? Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN * 2
    : displayedProducts.length;
  const endIdx = shouldVirtualize
    ? Math.min(displayedProducts.length, startIdx + visibleCount)
    : displayedProducts.length;
  const visibleProducts = shouldVirtualize
    ? displayedProducts.slice(startIdx, endIdx)
    : displayedProducts;

  return (
    <>
      {/* Dim message stream behind picker */}
      <button
        type="button"
        aria-label={ui.chat.picker.backdropAria}
        onClick={onClose}
        className="absolute inset-0 z-10 bg-foreground/25 transition-opacity"
      />

      <div
        role="region"
        aria-label={ui.chat.picker.title}
        className={
          isMobileSheet
            ? "absolute inset-x-0 bottom-0 z-20 flex max-h-[70dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-lg"
            : "relative z-20 flex max-h-[320px] flex-col border-t border-border bg-card shadow-lg"
        }
      >
        {isMobileSheet ? (
          <div className="flex justify-center pt-2">
            <span className="h-1 w-9 rounded-full bg-border-strong" aria-hidden="true" />
          </div>
        ) : null}

        {/* Sticky picker header */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold text-text">{ui.chat.picker.title}</span>
            {viewerRole === "CUSTOMER" && (requests.length > 0 || orders.length > 0) ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTab("PRODUCT")}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === "PRODUCT"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-2 text-text-muted hover:text-text"
                  }`}
                >
                  {ui.chat.picker.tabPieces}
                </button>
                {requests.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("REQUEST")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      tab === "REQUEST"
                        ? "bg-primary text-on-primary"
                        : "bg-surface-2 text-text-muted hover:text-text"
                    }`}
                  >
                    {ui.chat.picker.tabRequests}
                  </button>
                ) : null}
                {orders.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("ORDER")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      tab === "ORDER"
                        ? "bg-primary text-on-primary"
                        : "bg-surface-2 text-text-muted hover:text-text"
                    }`}
                  >
                    {ui.chat.picker.tabOrders}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={ui.chat.picker.closeAria}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Sticky search bar for products */}
        {tab === "PRODUCT" ? (
          <div className="px-3 pb-2">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-3 size-4 text-text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ui.chat.picker.searchPlaceholder}
                aria-label={ui.chat.picker.searchAria}
                className="h-9 w-full rounded-full border border-border-strong bg-surface pr-3 pl-9 text-[15px] text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-[13px]"
              />
            </div>
          </div>
        ) : null}

        {/* Single internal scroll container (no double scrollbars) */}
        <div
          ref={listScrollRef}
          onScroll={handleListScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
        >
          {tab === "PRODUCT" ? (
            loading && displayedProducts.length === 0 ? (
              <div className="space-y-1.5 px-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex h-[60px] items-center gap-3 px-2">
                    <Skeleton className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingBag className="mb-1.5 size-5 text-text-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-text">{ui.chat.picker.noResultsTitle}</p>
                <p className="text-xs text-text-muted">{ui.chat.picker.noResultsText}</p>
              </div>
            ) : (
              <div
                style={
                  shouldVirtualize
                    ? {
                        height: displayedProducts.length * ROW_HEIGHT,
                        position: "relative",
                      }
                    : undefined
                }
              >
                <div
                  style={
                    shouldVirtualize
                      ? { transform: `translateY(${startIdx * ROW_HEIGHT}px)` }
                      : undefined
                  }
                >
                  {visibleProducts.map((p) => (
                    <div
                      key={p.productId}
                      onClick={() =>
                        onSelectShare(
                          "PRODUCT",
                          p.productId,
                          fill(ui.chat.picker.sharingProduct, { name: p.name }),
                        )
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectShare(
                            "PRODUCT",
                            p.productId,
                            fill(ui.chat.picker.sharingProduct, { name: p.name }),
                          );
                        }
                      }}
                      className="flex h-[60px] cursor-pointer items-center gap-3 rounded-xl px-2 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                        {p.thumbUrl || p.imageUrl ? (
                          <Image
                            src={p.thumbUrl || p.imageUrl || ""}
                            alt={p.name}
                            fill
                            sizes="48px"
                            loading="lazy"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-text">{p.name}</p>
                        <p className="truncate text-xs text-text-muted">
                          {p.priceMode === "PRICE_ON_REQUEST"
                            ? "Price on request"
                            : formatPrice(p.basePrice)}
                          {p.inStock === false ? " · Made to order" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectShare(
                            "PRODUCT",
                            p.productId,
                            fill(ui.chat.picker.sharingProduct, { name: p.name }),
                          );
                        }}
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-text hover:border-accent hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {ui.chat.picker.share}
                      </button>
                    </div>
                  ))}
                </div>
                {loadingMore ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="size-4 animate-spin text-text-muted" />
                  </div>
                ) : null}
              </div>
            )
          ) : tab === "REQUEST" ? (
            <div className="space-y-1 px-1">
              {requests.map((req) => (
                <button
                  key={req.requestId}
                  type="button"
                  onClick={() =>
                    onSelectShare(
                      "REQUEST",
                      req.requestId,
                      fill(ui.chat.picker.regardingRequest, { number: req.requestNumber }),
                    )
                  }
                  className="flex h-[58px] w-full items-center justify-between gap-3 rounded-xl px-2 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text">
                      {req.requestNumber} · {req.productName}
                    </p>
                    <p className="truncate text-xs text-text-muted">{req.status}</p>
                  </div>
                  <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3 text-xs font-medium text-text">
                    {ui.chat.picker.share}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-1">
              {orders.map((ord) => (
                <button
                  key={ord.orderId}
                  type="button"
                  onClick={() =>
                    onSelectShare(
                      "ORDER",
                      ord.orderId,
                      fill(ui.chat.picker.regardingOrder, { number: ord.orderNumber }),
                    )
                  }
                  className="flex h-[58px] w-full items-center justify-between gap-3 rounded-xl px-2 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text">
                      Order {ord.orderNumber}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {ord.status} · {formatMoneyExact(ord.total, ord.currency)}
                    </p>
                  </div>
                  <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3 text-xs font-medium text-text">
                    {ui.chat.picker.share}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
