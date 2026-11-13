import { Suspense, cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Gem } from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { RevealStagger } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Container, Section, getProductGridClassName } from "@/components/shared/primitives";
import { CollectionFilters } from "@/components/storefront/CollectionFilters";
import { ProductCard } from "@/components/storefront/ProductCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import {
  buildCatalogPageHref,
  parseCatalogFilterParams,
  type RawSearchParams,
} from "@/lib/search-params";
import {
  buildBreadcrumbListJsonLd,
  buildCollectionJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/seo/jsonld";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  buildCollectionCanonicalPath,
  buildMetadata,
  formatCollectionMetaDescription,
  formatCollectionMetaTitle,
} from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getAllActiveCategoriesTree,
  getSitemapCategories,
  queryCollectionProducts,
  resolveCategoryByPath,
} from "@/modules/catalog/catalog.public";
import {
  getActiveLandingFacet,
  listActiveLandingFacetsForCategory,
  listSitemapLandingFacets,
  type LandingFacetDTO,
} from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface CollectionsPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<RawSearchParams>;
}

const resolveCollectionOrFacet = cache(async function resolveCollectionOrFacet(
  pathStr: string,
): Promise<
  | { kind: "all" }
  | {
      kind: "category";
      category: Extract<
        Awaited<ReturnType<typeof resolveCategoryByPath>>,
        { kind: "category" }
      >["category"];
    }
  | { kind: "redirect"; newPath: string }
  | {
      kind: "facet";
      facet: LandingFacetDTO;
      parentCategory: Extract<
        Awaited<ReturnType<typeof resolveCategoryByPath>>,
        { kind: "category" }
      >["category"];
    }
  | null
> {
  if (!pathStr) {
    return { kind: "all" };
  }

  const resolved = await resolveCategoryByPath(pathStr);
  if (resolved) {
    if (resolved.kind === "redirect") {
      return { kind: "redirect", newPath: resolved.newPath };
    }
    return { kind: "category", category: resolved.category };
  }

  const segments = pathStr.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const facetSlug = segments[segments.length - 1]!;
    const parentPath = segments.slice(0, -1).join("/");
    const [parentResolved, facet] = await Promise.all([
      resolveCategoryByPath(parentPath),
      getActiveLandingFacet(parentPath, facetSlug),
    ]);
    if (facet && parentResolved && parentResolved.kind === "category") {
      return { kind: "facet", facet, parentCategory: parentResolved.category };
    }
  }

  return null;
});

function buildFacetQueryOverrides(facet: LandingFacetDTO | null) {
  if (!facet) return {};
  const fp = facet.filterParams;
  return {
    ...(fp.metal && fp.metal.length > 0 ? { metal: fp.metal } : {}),
    ...(fp.shape && fp.shape.length > 0 ? { shape: fp.shape } : {}),
    ...(fp.origin && fp.origin.length > 0 ? { origin: fp.origin } : {}),
    ...(fp.certification && fp.certification.length > 0 ? { certification: fp.certification } : {}),
    ...(fp.color && fp.color.length > 0 ? { color: fp.color } : {}),
    ...(fp.clarity && fp.clarity.length > 0 ? { clarity: fp.clarity } : {}),
    ...(fp.minPrice !== undefined ? { minPrice: fp.minPrice } : {}),
    ...(fp.maxPrice !== undefined ? { maxPrice: fp.maxPrice } : {}),
    ...(fp.featured ? { featured: true } : {}),
  };
}

function formatPriceRangeLabel(
  items: Array<{ basePrice: string; priceMode: string }>,
  currency: string,
): string | null {
  const numericPrices = items
    .filter((p) => p.priceMode === "FIXED")
    .map((p) => Number(p.basePrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (numericPrices.length === 0) return null;
  const min = Math.min(...numericPrices);
  const max = Math.max(...numericPrices);
  if (min === max) return `from ${formatMoney(min, currency)}`;
  return `${formatMoney(min, currency)}–${formatMoney(max, currency)}`;
}

export async function generateStaticParams(): Promise<Array<{ slug?: string[] }>> {
  const base: Array<{ slug?: string[] }> = [{ slug: undefined }];
  try {
    const [categories, facets] = await Promise.all([
      getSitemapCategories(),
      listSitemapLandingFacets(),
    ]);
    for (const category of categories.slice(0, 100)) {
      const segments = category.path.split("/").filter(Boolean);
      if (segments.length > 0) {
        base.push({ slug: segments });
      }
    }
    for (const facet of facets.slice(0, 100)) {
      const segments = [...facet.categoryPath.split("/").filter(Boolean), facet.facetSlug];
      if (segments.length >= 2) {
        base.push({ slug: segments });
      }
    }
  } catch {
    // Allow build without live database (e.g. multi-stage Docker build).
  }
  return base;
}

export async function generateMetadata({
  params,
  searchParams,
}: CollectionsPageProps): Promise<Metadata> {
  await connection();
  const [{ slug }, rawSearch, settings] = await Promise.all([
    params,
    searchParams,
    getPublicStoreSettings(),
  ]);
  const pathStr = slug?.join("/") ?? "";
  const basePath = pathStr ? `/collections/${pathStr}` : "/collections";
  const { canonicalPath, isFiltered } = buildCollectionCanonicalPath(basePath, rawSearch);
  const rawPage = Array.isArray(rawSearch.page) ? rawSearch.page[0] : rawSearch.page;
  const pageNum = !isFiltered && rawPage && Number(rawPage) > 1 ? Math.floor(Number(rawPage)) : 1;

  const target = await resolveCollectionOrFacet(pathStr);
  if (!target || target.kind === "redirect") {
    return buildMetadata({
      title: "Collection",
      description: `Explore fine jewellery crafted in 18K recycled gold and platinum by ${settings.storeName}.`,
      pathname: basePath,
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
  }

  if (target.kind === "all") {
    const defaultResult = await queryCollectionProducts({
      ...parseCatalogFilterParams({}),
      categoryPath: null,
      page: pageNum,
    });
    const priceRange = formatPriceRangeLabel(defaultResult.items, settings.currency);
    const titleBase = formatCollectionMetaTitle({
      name: "All Fine Jewellery Collections",
      brandName: settings.storeName,
      pageNumber: pageNum,
      templates: settings.seoTemplates,
    });
    const prevPath = pageNum > 1 ? buildCatalogPageHref(basePath, {}, pageNum - 1) : undefined;
    const nextPath =
      pageNum < defaultResult.totalPages
        ? buildCatalogPageHref(basePath, {}, pageNum + 1)
        : undefined;

    const dynamicOgUrl = `/api/og/collection?path=${encodeURIComponent(pathStr)}`;

    return buildMetadata({
      absoluteTitle: titleBase,
      description: formatCollectionMetaDescription({
        name: "Fine Jewellery",
        description:
          "Browse GIA and IGI certified engagement rings, wedding bands, diamond pendants, earrings, and tennis bracelets crafted in 18K recycled gold and platinum.",
        count: defaultResult.total,
        priceRange,
        brandName: settings.storeName,
        templates: settings.seoTemplates,
      }),
      pathname: canonicalPath,
      canonical: canonicalPath,
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
      images: [{ url: dynamicOgUrl, alt: titleBase, width: 1200, height: 630 }],
      pagination: { previous: prevPath, next: nextPath },
      robots: isFiltered || defaultResult.total === 0 ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
    });
  }

  if (target.kind === "facet") {
    const { facet, parentCategory } = target;
    const defaultResult = await queryCollectionProducts({
      ...parseCatalogFilterParams({}),
      ...buildFacetQueryOverrides(facet),
      categoryPath: parentCategory.path,
      categoryIds: parentCategory.descendantIds,
      page: pageNum,
    });
    const priceRange = formatPriceRangeLabel(defaultResult.items, settings.currency);
    const title = formatCollectionMetaTitle({
      name: facet.h1 || facet.name,
      seoTitle: facet.seoTitle,
      brandName: settings.storeName,
      pageNumber: pageNum,
      templates: settings.seoTemplates,
    });
    const prevPath = pageNum > 1 ? buildCatalogPageHref(basePath, {}, pageNum - 1) : undefined;
    const nextPath =
      pageNum < defaultResult.totalPages
        ? buildCatalogPageHref(basePath, {}, pageNum + 1)
        : undefined;

    const facetOgFallback = `/api/og/collection?path=${encodeURIComponent(pathStr)}`;

    return buildMetadata({
      absoluteTitle: title,
      description: formatCollectionMetaDescription({
        name: facet.name,
        seoDescription: facet.seoDescription,
        description: facet.introCopy,
        count: defaultResult.total,
        priceRange,
        brandName: settings.storeName,
        templates: settings.seoTemplates,
      }),
      keywords: facet.seoKeywords ?? undefined,
      ogTitle: facet.ogTitle ?? undefined,
      ogDescription: facet.ogDescription ?? undefined,
      pathname: canonicalPath,
      canonical: facet.canonicalOverride ?? canonicalPath,
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
      images: facet.ogImageUrl
        ? [{ url: facet.ogImageUrl, alt: facet.name, width: 1200, height: 630 }]
        : parentCategory.imageUrl
          ? [{ url: parentCategory.imageUrl, alt: facet.name }]
          : [{ url: facetOgFallback, alt: facet.name, width: 1200, height: 630 }],
      pagination: { previous: prevPath, next: nextPath },
      robots:
        isFiltered || facet.noindex || defaultResult.total === 0
          ? NOINDEX_FOLLOW_ROBOTS
          : INDEXABLE_ROBOTS,
    });
  }

  const cat = target.category;
  const defaultResult = await queryCollectionProducts({
    ...parseCatalogFilterParams({}),
    categoryPath: cat.path,
    categoryIds: cat.descendantIds,
    page: pageNum,
  });
  const priceRange = formatPriceRangeLabel(defaultResult.items, settings.currency);
  const title = formatCollectionMetaTitle({
    name: cat.name,
    seoTitle: cat.seoTitle,
    brandName: settings.storeName,
    pageNumber: pageNum,
    templates: settings.seoTemplates,
  });
  const prevPath = pageNum > 1 ? buildCatalogPageHref(basePath, {}, pageNum - 1) : undefined;
  const nextPath =
    pageNum < defaultResult.totalPages
      ? buildCatalogPageHref(basePath, {}, pageNum + 1)
      : undefined;

  const categoryOgFallback = `/api/og/collection?path=${encodeURIComponent(pathStr)}`;

  return buildMetadata({
    absoluteTitle: title,
    description: formatCollectionMetaDescription({
      name: cat.name,
      seoDescription: cat.seoDescription,
      description: cat.seoIntroCopy ?? cat.description,
      count: defaultResult.total,
      priceRange,
      brandName: settings.storeName,
      templates: settings.seoTemplates,
    }),
    keywords: cat.seoKeywords ?? undefined,
    ogTitle: cat.ogTitle ?? undefined,
    ogDescription: cat.ogDescription ?? undefined,
    pathname: canonicalPath,
    canonical: cat.canonicalOverride ?? canonicalPath,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    images:
      cat.ogImageUrl || cat.imageUrl
        ? [
            {
              url: (cat.ogImageUrl ?? cat.imageUrl)!,
              alt: cat.name,
            },
          ]
        : [{ url: categoryOgFallback, alt: cat.name, width: 1200, height: 630 }],
    pagination: { previous: prevPath, next: nextPath },
    robots:
      isFiltered || Boolean(cat.noindex) || defaultResult.total === 0
        ? NOINDEX_FOLLOW_ROBOTS
        : INDEXABLE_ROBOTS,
  });
}

type CollectionQueryResult = Awaited<ReturnType<typeof queryCollectionProducts>>;

function CollectionsProductGrid({
  result,
  resolvedCategoryName,
  rawSearch,
  basePath,
  currency,
}: {
  result: CollectionQueryResult;
  resolvedCategoryName: string | null;
  rawSearch: RawSearchParams;
  basePath: string;
  currency: string;
}) {
  const hasFilters = Object.keys(rawSearch).length > 0;
  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={Gem}
        title={
          resolvedCategoryName && result.total === 0
            ? "No pieces in this collection yet"
            : "No pieces match"
        }
        description="Adjust your carat, metal, or price filters, or view the full catalogue."
        actionLabel={hasFilters ? "Clear filters" : "All jewellery"}
        actionHref={hasFilters ? basePath : "/collections"}
        suggestions={[
          { label: "All Jewellery", href: "/collections" },
          { label: "Rings", href: "/collections/rings" },
          { label: "Necklaces", href: "/collections/necklaces" },
        ]}
      />
    );
  }

  return (
    <>
      <h2 className="sr-only">Collection Creations</h2>
      <RevealStagger className={getProductGridClassName("catalog")}>
        {result.items.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            currency={currency}
            headingLevel="h3"
            priority={idx < 3}
            preload={idx === 0}
          />
        ))}
      </RevealStagger>

      <div className="pt-6">
        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          buildHref={(page) => buildCatalogPageHref(basePath, rawSearch, page)}
        />
      </div>
    </>
  );
}

function CollectionsCatalogFallback({
  result,
  resolvedCategoryName,
  basePath,
  currency,
}: {
  result: CollectionQueryResult;
  resolvedCategoryName: string | null;
  basePath: string;
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside aria-hidden="true" className="hidden w-[280px] shrink-0 lg:block xl:w-[300px]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 border-b border-border pb-3">
            <p className="text-base font-semibold text-foreground">Filters</p>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <p className="tabular-nums-price text-sm text-text-2">
            {result.total} {result.total === 1 ? "piece" : "pieces"}
          </p>
          <span className="inline-flex h-11 items-center text-xs text-muted-foreground">
            Sort: Curated &amp; Featured
          </span>
        </div>

        <CollectionsProductGrid
          result={result}
          resolvedCategoryName={resolvedCategoryName}
          rawSearch={{}}
          basePath={basePath}
          currency={currency}
        />
      </div>
    </div>
  );
}

async function CollectionsFilteredView({
  searchParams,
  categoryPathForQuery,
  descendantIds,
  subcategories,
  resolvedCategoryName,
  basePath,
  currency,
  facet,
}: {
  searchParams: Promise<RawSearchParams>;
  categoryPathForQuery: string | null;
  descendantIds?: string[];
  subcategories: Array<{ name: string; path: string; productCount: number }>;
  resolvedCategoryName: string | null;
  basePath: string;
  currency: string;
  facet: LandingFacetDTO | null;
}) {
  const rawSearch = await searchParams;
  const parsedFilters = parseCatalogFilterParams(rawSearch);
  const facetOverrides = buildFacetQueryOverrides(facet);

  const result = await queryCollectionProducts({
    ...parsedFilters,
    ...facetOverrides,
    categoryPath: categoryPathForQuery,
    categoryIds: descendantIds,
  });

  return (
    <CollectionFilters
      facets={result.facets}
      totalCount={result.total}
      currentSort={parsedFilters.sort ?? "featured"}
      subcategories={subcategories}
    >
      <CollectionsProductGrid
        result={result}
        resolvedCategoryName={resolvedCategoryName}
        rawSearch={rawSearch}
        basePath={basePath}
        currency={currency}
      />
    </CollectionFilters>
  );
}

async function CollectionsBody({ params, searchParams }: CollectionsPageProps) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);

  const pathStr = slug?.join("/") ?? "";
  const target = await resolveCollectionOrFacet(pathStr);

  if (!target) {
    notFound();
  }
  if (target.kind === "redirect") {
    permanentRedirect(`/collections/${target.newPath}`);
  }

  const resolvedCategory =
    target.kind === "category"
      ? target.category
      : target.kind === "facet"
        ? target.parentCategory
        : null;
  const activeFacet = target.kind === "facet" ? target.facet : null;
  const categoryPathForQuery = resolvedCategory?.path ?? null;

  let rootCategories: Array<{ name: string; path: string; productCount: number }> = [];
  if (!resolvedCategory) {
    const tree = await getAllActiveCategoriesTree();
    rootCategories = tree.map((c) => ({
      name: c.name,
      path: c.path,
      productCount: c.productCount,
    }));
  }

  const defaultFilters = {
    ...parseCatalogFilterParams({}),
    ...buildFacetQueryOverrides(activeFacet),
  };

  const facetLookupCategoryPath = activeFacet
    ? activeFacet.categoryPath
    : (resolvedCategory?.path ?? null);

  const [defaultResult, articles, siblingFacets] = await Promise.all([
    queryCollectionProducts({
      ...defaultFilters,
      categoryPath: categoryPathForQuery,
      categoryIds: resolvedCategory?.descendantIds,
    }),
    getPublishedArticles(),
    facetLookupCategoryPath
      ? listActiveLandingFacetsForCategory(facetLookupCategoryPath)
      : Promise.resolve([]),
  ]);

  const basePath = activeFacet
    ? `/collections/${activeFacet.categoryPath}/${activeFacet.facetSlug}`
    : pathStr
      ? `/collections/${pathStr}`
      : "/collections";

  const relevantArticles = articles
    .filter(
      (a) =>
        !resolvedCategory ||
        a.relatedCategorySlug === resolvedCategory.slug ||
        a.relatedCategorySlug === resolvedCategory.path,
    )
    .slice(0, 3);
  const displayArticles = relevantArticles.length > 0 ? relevantArticles : articles.slice(0, 3);

  const collectionTitle = activeFacet
    ? activeFacet.h1 || activeFacet.name
    : (resolvedCategory?.name ?? "All Fine Jewellery Collections");
  const collectionDescription = activeFacet
    ? (activeFacet.introCopy ??
      `Explore curated ${activeFacet.name} pieces from ${settings.storeName}, crafted in hallmarked precious metals.`)
    : (resolvedCategory?.description ??
      "Explore certified diamond solitaires, 18K gold bands, pendants, studs, and bracelets crafted for heirloom permanence.");

  const jsonLdBreadcrumbs = [{ name: "Home", path: "/" }];
  if (resolvedCategory) {
    jsonLdBreadcrumbs.push({ name: "Collections", path: "/collections" });
    for (const crumb of resolvedCategory.breadcrumbs) {
      jsonLdBreadcrumbs.push({
        name: crumb.name,
        path: `/collections/${crumb.path}`,
      });
    }
    if (activeFacet) {
      jsonLdBreadcrumbs.push({
        name: activeFacet.name,
        path: basePath,
      });
    }
  } else {
    jsonLdBreadcrumbs.push({ name: "Collections", path: "/collections" });
  }

  const collectionJsonLd = buildCollectionJsonLd({
    name: collectionTitle,
    description: collectionDescription,
    path: basePath,
    products: defaultResult.items,
    currency: settings.currency,
  });
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(jsonLdBreadcrumbs);

  const entityFaqs = activeFacet ? activeFacet.seoFaqs : (resolvedCategory?.seoFaqs ?? []);
  const faqJsonLd = entityFaqs && entityFaqs.length > 0 ? buildFaqPageJsonLd(entityFaqs) : null;

  const breadcrumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
  if (resolvedCategory) {
    breadcrumbs.push({ label: "Collections", href: "/collections" });
    for (const crumb of resolvedCategory.breadcrumbs) {
      breadcrumbs.push({
        label: crumb.name,
        href:
          !activeFacet && crumb.path === resolvedCategory.path
            ? undefined
            : `/collections/${crumb.path}`,
      });
    }
    if (activeFacet) {
      breadcrumbs.push({ label: activeFacet.name });
    }
  } else {
    breadcrumbs.push({ label: "Collections" });
  }

  const subcategories = resolvedCategory
    ? resolvedCategory.children.map((c) => ({
        name: c.name,
        path: c.path,
        productCount: c.productCount,
      }))
    : rootCategories;

  const showTopIntro =
    resolvedCategory &&
    !activeFacet &&
    resolvedCategory.seoIntroCopy &&
    resolvedCategory.seoIntroPosition !== "bottom";

  return (
    <Section spacing="sm">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <Container variant="wide">
        <Breadcrumbs items={breadcrumbs} />

        <header className="mt-2 mb-6 border-b border-border pb-6">
          <h1 className="type-h1 line-clamp-2 font-display font-semibold break-words text-foreground">
            {activeFacet
              ? activeFacet.h1 || activeFacet.name
              : (resolvedCategory?.name ?? "All Jewellery")}
          </h1>
          <p className="prose-limit mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:line-clamp-none sm:text-base">
            {showTopIntro ? resolvedCategory.seoIntroCopy : collectionDescription}
          </p>

          {subcategories.length > 0 && (
            <div className="chips-scroll-fade -mx-1 mt-5 overflow-hidden sm:mx-0 sm:overflow-visible">
              <div className="flex scrollbar-none flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                {!resolvedCategory && (
                  <Link
                    href="/collections"
                    title="All Jewellery"
                    aria-current="page"
                    className="transition-ui inline-flex min-h-11 max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary px-3.5 py-1.5 text-xs font-medium text-on-primary shadow-sm sm:min-h-9"
                  >
                    <span className="truncate">All</span>
                    <span className="tabular-nums-price shrink-0 opacity-80">
                      ({defaultResult.total})
                    </span>
                  </Link>
                )}
                {subcategories.map((sub) => {
                  const isActive = basePath === `/collections/${sub.path}`;
                  return (
                    <Link
                      key={sub.path}
                      href={`/collections/${sub.path}`}
                      title={sub.name}
                      aria-current={isActive ? "page" : undefined}
                      className={
                        isActive
                          ? "transition-ui inline-flex min-h-11 max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary px-3.5 py-1.5 text-xs font-medium text-on-primary shadow-sm sm:min-h-9"
                          : "transition-ui inline-flex min-h-11 max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-border-strong hover:bg-muted sm:min-h-9"
                      }
                    >
                      <span className="min-w-0 truncate">{sub.name}</span>
                      <span
                        className={
                          isActive
                            ? "tabular-nums-price shrink-0 opacity-80"
                            : "tabular-nums-price shrink-0 text-muted-foreground"
                        }
                      >
                        ({sub.productCount})
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {siblingFacets.length > 0 && (
            <nav aria-label="Curated collection facets" className="mt-4 flex flex-wrap gap-2">
              {siblingFacets.map((facetItem) => {
                const href = `/collections/${facetItem.categoryPath}/${facetItem.facetSlug}`;
                const isActiveFacet = activeFacet?.id === facetItem.id;
                return (
                  <Link
                    key={facetItem.id}
                    href={href}
                    aria-current={isActiveFacet ? "page" : undefined}
                    className={
                      isActiveFacet
                        ? "inline-flex min-h-9 items-center rounded-md border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        : "inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground hover:border-border-strong hover:text-foreground"
                    }
                  >
                    {facetItem.name}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <Suspense
          fallback={
            <CollectionsCatalogFallback
              result={defaultResult}
              resolvedCategoryName={collectionTitle}
              basePath={basePath}
              currency={settings.currency}
            />
          }
        >
          <CollectionsFilteredView
            searchParams={searchParams}
            categoryPathForQuery={categoryPathForQuery}
            descendantIds={resolvedCategory?.descendantIds}
            subcategories={subcategories}
            resolvedCategoryName={collectionTitle}
            basePath={basePath}
            currency={settings.currency}
            facet={activeFacet}
          />
        </Suspense>

        {resolvedCategory &&
          !activeFacet &&
          resolvedCategory.seoIntroCopy &&
          resolvedCategory.seoIntroPosition === "bottom" && (
            <div className="mt-12 rounded-xl border border-border bg-surface p-6">
              <p className="prose-limit text-sm leading-relaxed text-muted-foreground">
                {resolvedCategory.seoIntroCopy}
              </p>
            </div>
          )}

        {entityFaqs && entityFaqs.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="type-h2 font-display font-semibold text-foreground">
              {collectionTitle} — Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-5">
              {entityFaqs.map((faq, idx) => (
                <div key={idx} className="py-4">
                  <h3 className="text-base font-medium text-foreground">{faq.question}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          aria-labelledby="collection-guidance-heading"
          className="mt-10 border-t border-border pt-6 sm:mt-16"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="about-collection" className="border-b-0">
              <AccordionTrigger
                id="collection-guidance-heading"
                className="text-base font-semibold text-foreground hover:no-underline"
              >
                About this collection
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid gap-8 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-6">
                    <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
                      Selecting your{" "}
                      {resolvedCategory?.name.toLowerCase() ?? "fine jewellery piece"}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      Every {resolvedCategory ? resolvedCategory.name.toLowerCase() : "creation"} in
                      the {settings.storeName} collection is hallmarked for 18K recycled gold or 950
                      platinum purity, independently graded where applicable by GIA or IGI
                      laboratories, and dispatched with signature-required courier insurance and a{" "}
                      {settings.returnWindowDays}-day return guarantee.
                    </p>
                  </div>
                  {displayArticles.length > 0 && (
                    <div className="min-w-0 lg:col-span-6">
                      <p className="text-sm font-semibold text-foreground">Buying guides</p>
                      <ul className="mt-2.5 space-y-2.5 text-sm">
                        {displayArticles.map((guide) => (
                          <li key={guide.id} className="min-w-0">
                            <Link
                              href={`/guides/${guide.slug}`}
                              className="transition-ui font-medium text-foreground underline decoration-border underline-offset-4 hover:text-accent-text hover:decoration-accent"
                            >
                              {guide.title}
                            </Link>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {guide.excerpt}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </Container>
    </Section>
  );
}

// Existence is checked before streaming so unknown URLs return a real 404; that wait is intentional.
export const instant = false;

export default async function CollectionsPage(props: CollectionsPageProps) {
  // Resolve existence before the Suspense boundary so unknown paths return a real HTTP 404
  // (once streaming starts the status is committed to 200).
  await connection();
  const { slug } = await props.params;
  if (!(await resolveCollectionOrFacet(slug?.join("/") ?? ""))) notFound();

  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container variant="wide">
            <div
              className="space-y-6 py-4"
              role="status"
              aria-busy="true"
              aria-label="Loading collection"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-72 max-w-full" />
              <div className={getProductGridClassName("catalog", "pt-4")}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="aspect-[4/5] rounded-lg" />
                ))}
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <CollectionsBody {...props} />
    </Suspense>
  );
}
