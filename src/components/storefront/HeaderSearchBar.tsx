"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Price } from "@/components/shared/Price";
import { Button, IconButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SearchSuggestResponse } from "@/modules/search/search.service";

export function HeaderSearchBar() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<SearchSuggestResponse | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query.trim())}&limit=6`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const json = (await res.json()) as SearchSuggestResponse;
          setData(json);
        }
      } catch {
        // Ignore aborted fetch on typing
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    setOpen(false);
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <IconButton aria-label="Search fine jewellery">
          <Search className="size-4" aria-hidden="true" />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="top-16 max-w-2xl translate-y-0 p-0">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-3">
          <DialogTitle className="font-display text-xl">Search the Maison</DialogTitle>
          <DialogDescription>
            Search by diamond shape, 18K gold metal, certification (GIA, IGI), or SKU.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="border-b border-border px-5 py-3">
          <div className="flex gap-2">
            <label htmlFor="header-search-input" className="sr-only">
              Search jewellery pieces
            </label>
            <Input
              id="header-search-input"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Oval solitaire, 18K rose gold, GIA, AUR-RNG..."
              className="h-11"
            />
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </div>
        </form>

        <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
              <span>Searching catalogue…</span>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-5">
              {data.categories.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Collections
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/collections/${cat.path}`}
                        onClick={() => setOpen(false)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-muted"
                      >
                        <span>{cat.name}</span>
                        <span className="text-muted-foreground">({cat.productCount})</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.products.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Suggested Pieces
                  </p>
                  <ul className="divide-y divide-border rounded-md border border-border bg-background">
                    {data.products.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/60"
                        >
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.altText ?? item.name}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-base font-medium text-foreground">
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.categoryName} · {item.sku}
                            </p>
                          </div>
                          <Price
                            amount={item.basePrice}
                            isPriceOnRequest={item.priceMode === "PRICE_ON_REQUEST"}
                            size="sm"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {query.trim().length >= 2 && data.products.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No direct matches found for &ldquo;{query.trim()}&rdquo;. Press Search to run a
                  full catalogue lookup.
                </p>
              )}

              {query.trim().length >= 2 && (
                <div className="pt-1">
                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
                  >
                    <span>See all results for &ldquo;{query.trim()}&rdquo;</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
