"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, FolderOpen, Gem, Search, X } from "lucide-react";
import { m } from "motion/react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { menuContainerVariants, menuItemVariants } from "@/lib/motion";

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

interface SuggestGuide {
  id: string;
  title: string;
  slug: string;
  authorName: string;
}

interface SuggestResponse {
  query: string;
  categories: SuggestCategory[];
  products: SuggestProduct[];
  guides?: SuggestGuide[];
}

const POPULAR_CHIPS = ["Solitaire", "Platinum", "18K Gold", "Oval", "GIA"] as const;
const RECENT_STORAGE_KEY = "ma_recent_searches";

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  const clean = term.trim();
  if (clean.length < 2) return;
  try {
    const existing = readRecentSearches().filter(
      (item) => item.toLowerCase() !== clean.toLowerCase(),
    );
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([clean, ...existing].slice(0, 4)),
    );
  } catch {
    // Ignore storage issues
  }
}

const emptySubscribe = () => () => {};

export function HeaderSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SuggestResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [recentVersion, setRecentVersion] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const recentSearches = React.useMemo(
    () => (mounted && open ? readRecentSearches() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, open, recentVersion],
  );

  React.useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}&limit=5`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as SuggestResponse;
          setResults(data);
        }
      } catch {
        // Ignore aborted or failed fetches cleanly
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const submitSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    saveRecentSearch(clean);
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(clean)}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitSearch(query);
  };

  const handleClearRecent = () => {
    try {
      window.localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch {
      // Ignore storage issues
    }
    setRecentVersion((v) => v + 1);
  };

  const trimmed = query.trim();
  const hasProducts = (results?.products.length ?? 0) > 0;
  const hasCategories = (results?.categories.length ?? 0) > 0;
  const hasGuides = (results?.guides?.length ?? 0) > 0;
  const hasAnyResults = hasProducts || hasCategories || hasGuides;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 sm:inset-auto sm:top-[10%] sm:left-1/2 sm:max-h-[80dvh] sm:w-[calc(100%-2rem)] sm:max-w-[600px] sm:-translate-x-1/2 sm:translate-y-0 sm:rounded-lg">
        <DialogTitle className="sr-only">Search Maison Aurelia catalogue</DialogTitle>
        <DialogDescription className="sr-only">
          Search across fine jewellery pieces, collections, and buying guides.
        </DialogDescription>

        {/* Search input header bar (leaves room right for Dialog close X) */}
        <form
          onSubmit={handleSubmit}
          className="safe-area-pt flex shrink-0 items-center gap-2 border-b border-border bg-card/40 pr-14 pl-4 transition-colors focus-within:border-foreground/45 sm:pr-14 sm:pl-5"
        >
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <label htmlFor="header-search-input" className="sr-only">
            Search jewellery, SKU, stone shape, or collection
          </label>
          <input
            id="header-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rings, carats, collections, guides..."
            className="h-14 w-full min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-foreground shadow-none ring-0 outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          {trimmed.length >= 2 ? (
            <button
              type="submit"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Search
            </button>
          ) : (
            <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ESC
            </kbd>
          )}
        </form>

        <div className="safe-area-pb flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Quick / Recent & Popular chips when input is short */}
          {trimmed.length < 2 && (
            <div className="mb-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Type a stone shape, metal (e.g. Platinum, 18K Gold), GIA report, or SKU. Press Enter
                to view all matching pieces.
              </p>

              {recentSearches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Recent
                    </p>
                    <button
                      type="button"
                      onClick={handleClearRecent}
                      className="inline-flex min-h-11 cursor-pointer items-center px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="transition-ui inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground hover:border-foreground/35 hover:bg-muted"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Popular Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setQuery(chip)}
                      className="transition-ui inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground hover:border-foreground/35 hover:bg-muted"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading && trimmed.length >= 2 && (
            <div className="space-y-3 py-2" role="status" aria-live="polite">
              <span className="sr-only">Searching catalogue…</span>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          )}

          {!loading && results && !hasAnyResults && trimmed.length >= 2 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No pieces match &ldquo;{trimmed}&rdquo;.
              </p>
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                onClick={() => onOpenChange(false)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline"
              >
                Search full catalogue <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}

          {results && hasAnyResults && (
            <m.div
              key={results.query}
              variants={menuContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-5"
            >
              {/* Products */}
              {hasProducts && (
                <section aria-label="Matching products">
                  <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Products
                  </p>
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {results.products.map((product) => (
                      <m.li key={product.id} variants={menuItemVariants}>
                        <Link
                          href={`/products/${product.slug}`}
                          onClick={() => {
                            if (trimmed.length >= 2) saveRecentSearch(trimmed);
                            onOpenChange(false);
                          }}
                          className="flex items-center gap-3 p-3 transition-colors hover:bg-muted"
                        >
                          <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                            {product.imageUrl ? (
                              <Image
                                src={product.imageUrl}
                                alt={product.altText ?? product.name}
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <Gem
                                  className="size-4 text-muted-foreground/60"
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {product.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.categoryName}
                            </p>
                          </div>
                          <span className="tabular-nums-price max-w-[40%] shrink-0 text-right text-xs font-medium text-foreground sm:text-sm">
                            {product.priceMode === "PRICE_ON_REQUEST"
                              ? "Upon request"
                              : formatPrice(product.basePrice)}
                          </span>
                        </Link>
                      </m.li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Collections */}
              {hasCategories && (
                <section aria-label="Matching collections">
                  <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Collections
                  </p>
                  <ul className="space-y-1">
                    {results.categories.map((cat) => (
                      <m.li key={cat.id} variants={menuItemVariants}>
                        <Link
                          href={`/collections/${cat.path}`}
                          onClick={() => onOpenChange(false)}
                          className="flex min-h-11 items-center justify-between rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                        >
                          <span className="flex items-center gap-2">
                            <FolderOpen
                              className="size-4 text-muted-foreground"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            <span>{cat.name}</span>
                          </span>
                          {cat.productCount > 0 && (
                            <span className="tabular-nums-price text-xs text-muted-foreground">
                              {cat.productCount} {cat.productCount === 1 ? "piece" : "pieces"}
                            </span>
                          )}
                        </Link>
                      </m.li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Guides */}
              {hasGuides && (
                <section aria-label="Matching guides">
                  <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Guides
                  </p>
                  <ul className="space-y-1">
                    {results.guides?.map((guide) => (
                      <m.li key={guide.id} variants={menuItemVariants}>
                        <Link
                          href={`/guides/${guide.slug}`}
                          onClick={() => onOpenChange(false)}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <BookOpen
                              className="size-4 shrink-0 text-muted-foreground"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            <span className="truncate">{guide.title}</span>
                          </span>
                          <ArrowRight
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </Link>
                      </m.li>
                    ))}
                  </ul>
                </section>
              )}

              {trimmed.length >= 2 && (
                <div className="border-t border-border pt-3">
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmed)}`}
                    onClick={() => {
                      saveRecentSearch(trimmed);
                      onOpenChange(false);
                    }}
                    className="flex min-h-11 items-center justify-between rounded-md bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    <span>View all results for &ldquo;{trimmed}&rdquo;</span>
                    <ArrowRight className="size-4 text-accent-text" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </m.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
