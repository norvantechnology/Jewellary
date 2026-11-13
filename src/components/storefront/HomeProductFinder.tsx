"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, Gem, Search, Sparkles, X } from "lucide-react";
import { Price } from "@/components/shared/Price";
import { cn } from "@/lib/utils";
import type { PublicCategoryNodeDTO } from "@/modules/catalog/catalog.public";

interface SuggestProduct {
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

interface SuggestCategory {
  id: string;
  name: string;
  path: string;
  productCount: number;
}

interface SuggestResponse {
  query: string;
  categories: SuggestCategory[];
  products: SuggestProduct[];
}

const POPULAR_TERMS = ["Solitaire", "Emerald Cut", "18K Gold", "Platinum", "GIA"] as const;

const DISCOVERY_SHORTCUTS = [
  { label: "All Jewellery", href: "/collections" },
  { label: "Featured", href: "/collections?featured=1" },
  { label: "New Arrivals", href: "/collections?new=1" },
  { label: "Ready to Ship", href: "/collections?inStock=1" },
] as const;

export function HomeProductFinder({
  categories,
  currency = "USD",
}: {
  categories: PublicCategoryNodeDTO[];
  currency?: string;
}) {
  const router = useRouter();
  const inputId = React.useId();
  const listboxId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SuggestResponse | null>(null);

  const trimmed = query.trim();

  const orderedCategories = React.useMemo(() => {
    const populated = categories.filter((c) => c.productCount > 0);
    return (populated.length > 0 ? populated : categories).slice(0, 8);
  }, [categories]);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    if (!open || trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as SuggestResponse;
          setResults(data);
        }
      } catch {
        // Ignore aborted or transient fetch errors
      } finally {
        setLoading(false);
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const handleSelectPopular = (term: string) => {
    setQuery(term);
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open;
  const activeResults = trimmed.length >= 2 ? results : null;
  const isSearching = trimmed.length >= 2 && loading;
  const hasMatches =
    Boolean(activeResults) &&
    ((activeResults?.products.length ?? 0) > 0 || (activeResults?.categories.length ?? 0) > 0);

  return (
    <div ref={containerRef} className="w-full min-w-0 space-y-3">
      {/* Search bar + dropdown container */}
      <div className="relative z-20 min-w-0">
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Find jewellery pieces"
          className={cn(
            "flex items-center gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-sm transition-colors",
            "focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent/20",
          )}
        >
          <label htmlFor={inputId} className="sr-only">
            Search jewellery by stone shape, metal, or SKU
          </label>
          <Search
            className="ml-2 size-4 shrink-0 text-text-muted sm:ml-3"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (next.trim().length < 2) {
                setResults(null);
              }
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search rings, solitaire, 18K gold..."
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base text-text placeholder:text-text-muted focus:outline-none sm:px-2 sm:text-sm"
          />

          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}

          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover sm:px-4"
          >
            <span>Find</span>
            <ArrowRight
              className="hidden size-3.5 sm:inline"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </button>
        </form>

        {/* Instant suggestions / popular terms dropdown */}
        {showDropdown && (
          <div
            id={listboxId}
            role="region"
            aria-label="Search suggestions"
            className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-md"
          >
            {trimmed.length < 2 ? (
              <div className="p-3.5 sm:p-4">
                <p className="mb-2 text-xs font-medium tracking-wider text-text-muted uppercase">
                  Popular searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TERMS.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSelectPopular(term)}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-3"
                    >
                      <Sparkles
                        className="size-3 text-accent-text"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : isSearching && !activeResults ? (
              <div className="p-4 text-sm text-text-muted">Searching…</div>
            ) : !hasMatches ? (
              <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-2">
                  No instant matches for &ldquo;{trimmed}&rdquo;.
                </p>
                <Link
                  href={`/search?q=${encodeURIComponent(trimmed)}`}
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-accent-text hover:underline"
                >
                  <span>Search full catalog</span>
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="max-h-[65vh] divide-y divide-border overflow-y-auto overscroll-contain">
                {activeResults && activeResults.categories.length > 0 && (
                  <div className="p-3">
                    <p className="mb-2 px-1 text-[11px] font-medium tracking-wider text-text-muted uppercase">
                      Collections
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeResults.categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/collections/${cat.path}`}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-3"
                        >
                          <FolderOpen
                            className="size-3.5 text-accent-text"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span>{cat.name}</span>
                          {cat.productCount > 0 && (
                            <span className="text-text-muted tabular-nums">
                              ({cat.productCount})
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {activeResults && activeResults.products.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wider text-text-muted uppercase">
                      Pieces
                    </p>
                    <ul className="space-y-1">
                      {activeResults.products.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex min-h-14 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2"
                          >
                            <div className="ma-media-placeholder relative size-11 shrink-0 overflow-hidden rounded-md border border-border">
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.altText ?? item.name}
                                  fill
                                  sizes="44px"
                                  className="object-cover object-center"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center">
                                  <Gem
                                    className="size-4 text-accent-text/60"
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-text">{item.name}</p>
                              <p className="truncate text-xs text-text-muted">
                                {item.categoryName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-sm font-medium text-text">
                              {item.priceMode === "PRICE_ON_REQUEST" ? (
                                <span className="text-xs text-text-muted">Enquire</span>
                              ) : (
                                <Price amount={item.basePrice} currency={currency} />
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-bg-alt p-2.5">
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmed)}`}
                    onClick={() => setOpen(false)}
                    className="flex min-h-10 items-center justify-between rounded-lg px-2 text-sm font-medium text-accent-text transition-colors hover:bg-surface-2"
                  >
                    <span>See all results for &ldquo;{trimmed}&rdquo;</span>
                    <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-browse horizontal shelf on mobile, clean wrap on tablet/desktop */}
      <nav aria-label="Quick category shortcuts" className="relative z-10 w-full min-w-0">
        <div className="flex w-full min-w-0 scrollbar-none gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {DISCOVERY_SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-text shadow-sm transition-colors hover:border-border-strong hover:bg-surface-2 sm:min-h-9"
            >
              {shortcut.label}
            </Link>
          ))}
          {orderedCategories.map((category) => (
            <Link
              key={category.id}
              href={`/collections/${category.path}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3.5 text-xs font-medium text-text transition-colors hover:border-border-strong hover:bg-surface-3 sm:min-h-9"
            >
              <span>{category.name}</span>
              {category.productCount > 0 && (
                <span className="text-text-muted tabular-nums">{category.productCount}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
