import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import Link from "next/link";
import { Search as SearchIcon, X } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RevealStagger } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Container, Section, getProductGridClassName } from "@/components/shared/primitives";
import { CollectionFilters } from "@/components/storefront/CollectionFilters";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCatalogPageHref,
  parseCatalogFilterParams,
  type RawSearchParams,
} from "@/lib/search-params";
import { NOINDEX_FOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { getCategoryShortcuts } from "@/modules/catalog/catalog.public";
import { searchProducts } from "@/modules/search/search.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.search.seo, {
    pathname: "/search",
    canonical: "/search",
    robots: NOINDEX_FOLLOW_ROBOTS,
  });
}

async function SearchPageBody({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [rawSearch, settings, siteContent] = await Promise.all([
    searchParams,
    getPublicStoreSettings(),
    getSiteContent(),
  ]);
  const page = siteContent.pages.search;
  const withQuery = (text: string) => text.replace("{query}", result.query ?? "");
  const filters = parseCatalogFilterParams(rawSearch);
  const [result, categoryLinks] = await Promise.all([
    searchProducts(filters),
    getCategoryShortcuts(6),
  ]);

  return (
    <Section spacing="sm">
      <Container variant="wide">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.breadcrumb }]} />

        <header className="mt-2 mb-6 border-b border-border pb-6 sm:mb-8">
          <h1 className="type-h1 font-display font-semibold break-words text-foreground">
            {result.query ? withQuery(page.resultsHeading) : page.heading}
          </h1>

          <form
            action="/search"
            method="GET"
            className="mt-5 flex max-w-2xl flex-col gap-2.5 sm:flex-row sm:items-center"
          >
            <label htmlFor="search-page-input" className="sr-only">
              {page.inputLabel}
            </label>
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 transition-colors focus-within:border-foreground/50 focus-within:ring-2 focus-within:ring-ring md:h-11">
              <SearchIcon
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <input
                id="search-page-input"
                name="q"
                type="search"
                defaultValue={result.query}
                placeholder={page.placeholder}
                className="h-full w-full min-w-0 flex-1 border-0 bg-transparent text-base text-foreground shadow-none ring-0 outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {result.query && (
                <Link
                  href="/search"
                  aria-label="Clear search query"
                  className="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}
            </div>
            <Button type="submit" size="md" className="h-12 w-full shrink-0 sm:w-auto md:h-11">
              {page.submitLabel}
            </Button>
          </form>

          {!result.query && categoryLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {page.suggestionsLabel}
              </span>
              {categoryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-ui inline-flex min-h-11 items-center rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground hover:border-foreground/35 hover:bg-muted sm:min-h-9"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </header>

        <CollectionFilters
          facets={result.facets}
          totalCount={result.total}
          currentSort={filters.sort ?? "featured"}
        >
          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title={page.empty.title}
              description={result.query ? withQuery(page.empty.withQuery) : page.empty.withoutQuery}
              actionLabel={result.query ? page.empty.clearLabel : page.empty.browseLabel}
              actionHref={
                result.query ? `/search?q=${encodeURIComponent(result.query)}` : "/collections"
              }
              suggestions={categoryLinks}
            />
          ) : (
            <>
              <h2 className="sr-only">{page.resultsSrHeading}</h2>
              <RevealStagger className={getProductGridClassName("catalog")}>
                {result.items.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={settings.currency}
                    priority={idx < 3}
                  />
                ))}
              </RevealStagger>

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
          <Container variant="wide">
            <div
              className="space-y-6 py-4"
              role="status"
              aria-busy="true"
              aria-label="Searching products"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-72 max-w-full" />
              <div className={getProductGridClassName("catalog", "pt-4")}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="aspect-[4/5] rounded-lg" />
                ))}
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <SearchPageBody searchParams={searchParams} />
    </Suspense>
  );
}
