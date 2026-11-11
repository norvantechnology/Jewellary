import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { CollectionFilters } from "@/components/storefront/CollectionFilters";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildCatalogPageHref,
  parseCatalogFilterParams,
  type RawSearchParams,
} from "@/lib/search-params";
import { searchProducts } from "@/modules/search/search.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = {
  title: "Search Fine Jewellery",
  description: "Search certified diamond rings, necklaces, earrings, bracelets, metals, and SKUs.",
  robots: { index: false, follow: true },
};

async function SearchPageBody({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [rawSearch, settings] = await Promise.all([searchParams, getPublicStoreSettings()]);
  const filters = parseCatalogFilterParams(rawSearch);
  const result = await searchProducts(filters);

  return (
    <Section spacing="sm">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />

        <header className="mt-2 mb-8 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">Catalogue Lookup</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground">
            {result.query ? `Search: “${result.query}”` : "Search Our Collections"}
          </h1>

          <form action="/search" method="GET" className="mt-5 flex max-w-xl gap-2">
            <label htmlFor="search-page-input" className="sr-only">
              Search jewellery pieces
            </label>
            <Input
              id="search-page-input"
              name="q"
              type="search"
              defaultValue={result.query}
              placeholder="Search by shape, metal, GIA certificate, or SKU..."
              className="h-11 bg-card"
            />
            <Button type="submit" size="lg">
              Search
            </Button>
          </form>
        </header>

        <CollectionFilters
          facets={result.facets}
          totalCount={result.total}
          currentSort={filters.sort ?? "featured"}
        >
          {result.items.length === 0 ? (
            <EmptyState
              title="No Pieces Found"
              description={
                result.query
                  ? `We could not find pieces matching “${result.query}”. Try searching for a metal (e.g. Platinum, 18K Yellow Gold) or browse all collections.`
                  : "Enter a keyword above or browse all collections."
              }
              actionLabel="Browse All Pieces"
              actionHref="/collections"
            />
          ) : (
            <>
              <Grid cols={3}>
                {result.items.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={settings.currency}
                    priority={idx < 3}
                  />
                ))}
              </Grid>

              <div className="pt-6">
                <Pagination
                  currentPage={result.page}
                  totalPages={result.totalPages}
                  buildHref={(page) => buildCatalogPageHref("/search", rawSearch, page)}
                />
              </div>
            </>
          )}
        </CollectionFilters>
      </Container>
    </Section>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Searching catalogue…</div>
          </Container>
        </Section>
      }
    >
      <SearchPageBody searchParams={searchParams} />
    </Suspense>
  );
}
