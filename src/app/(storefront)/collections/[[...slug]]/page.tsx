import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { CollectionFilters } from "@/components/storefront/CollectionFilters";
import { ProductCard } from "@/components/storefront/ProductCard";
import {
  buildCatalogPageHref,
  parseCatalogFilterParams,
  type RawSearchParams,
} from "@/lib/search-params";
import { buildBreadcrumbListJsonLd, buildCollectionJsonLd } from "@/lib/seo/jsonld";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  buildCollectionCanonicalPath,
  buildMetadata,
} from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getAllActiveCategoriesTree,
  queryCollectionProducts,
  resolveCategoryByPath,
} from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface CollectionsPageProps {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: CollectionsPageProps): Promise<Metadata> {
  const [{ slug }, rawSearch, settings] = await Promise.all([
    params,
    searchParams,
    getPublicStoreSettings(),
  ]);
  const pathStr = slug?.join("/") ?? "";
  const basePath = pathStr ? `/collections/${pathStr}` : "/collections";
  const { canonicalPath, isFiltered } = buildCollectionCanonicalPath(basePath, rawSearch);
  const rawPage = Array.isArray(rawSearch.page) ? rawSearch.page[0] : rawSearch.page;
  const pageNum = !isFiltered && rawPage && Number(rawPage) > 1 ? Number(rawPage) : 1;

  if (!pathStr) {
    const titleBase = "All Fine Jewellery Collections";
    return buildMetadata({
      title: pageNum > 1 ? `${titleBase} — Page ${pageNum}` : titleBase,
      description:
        "Browse GIA and IGI certified engagement rings, wedding bands, diamond pendants, earrings, and tennis bracelets crafted in 18K recycled gold and platinum.",
      pathname: canonicalPath,
      canonical: canonicalPath,
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
      robots: isFiltered ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
    });
  }

  const resolved = await resolveCategoryByPath(pathStr);
  if (!resolved || resolved.kind !== "category") {
    return buildMetadata({
      title: "Collection",
      description: `Explore fine jewellery crafted in 18K recycled gold and platinum by ${settings.storeName}.`,
      pathname: basePath,
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
  }

  const baseTitle = resolved.category.seoTitle ?? resolved.category.name;
  return buildMetadata({
    title: pageNum > 1 ? `${baseTitle} — Page ${pageNum}` : baseTitle,
    description:
      resolved.category.seoDescription ??
      resolved.category.description ??
      `Explore ${resolved.category.name} crafted in 18K recycled gold and platinum with insured delivery and ${settings.returnWindowDays}-day returns.`,
    pathname: canonicalPath,
    canonical: canonicalPath,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    images: resolved.category.imageUrl
      ? [{ url: resolved.category.imageUrl, alt: resolved.category.name }]
      : undefined,
    robots: isFiltered ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
  });
}

async function CollectionsBody({ params, searchParams }: CollectionsPageProps) {
  const [{ slug }, rawSearch, settings] = await Promise.all([
    params,
    searchParams,
    getPublicStoreSettings(),
  ]);

  const pathStr = slug?.join("/") ?? "";
  let resolvedCategory:
    | Extract<Awaited<ReturnType<typeof resolveCategoryByPath>>, { kind: "category" }>["category"]
    | null = null;
  let rootCategories: Array<{ name: string; path: string; productCount: number }> = [];

  if (pathStr) {
    const resolved = await resolveCategoryByPath(pathStr);
    if (!resolved) {
      notFound();
    }
    if (resolved.kind === "redirect") {
      permanentRedirect(`/collections/${resolved.newPath}`);
    }
    resolvedCategory = resolved.category;
  } else {
    const tree = await getAllActiveCategoriesTree();
    rootCategories = tree.map((c) => ({
      name: c.name,
      path: c.path,
      productCount: c.productCount,
    }));
  }

  const filters = parseCatalogFilterParams(rawSearch);
  const [result, articles] = await Promise.all([
    queryCollectionProducts({
      ...filters,
      categoryPath: pathStr || null,
      categoryIds: resolvedCategory?.descendantIds,
    }),
    getPublishedArticles(),
  ]);

  const basePath = pathStr ? `/collections/${pathStr}` : "/collections";
  const relevantArticles = articles
    .filter(
      (a) =>
        !pathStr ||
        a.relatedCategorySlug === resolvedCategory?.slug ||
        a.relatedCategorySlug === pathStr,
    )
    .slice(0, 3);
  const displayArticles = relevantArticles.length > 0 ? relevantArticles : articles.slice(0, 3);

  const collectionTitle = resolvedCategory?.name ?? "All Fine Jewellery Collections";
  const collectionDescription =
    resolvedCategory?.description ??
    "Explore certified diamond solitaires, 18K gold bands, pendants, studs, and bracelets crafted for heirloom permanence.";

  const jsonLdBreadcrumbs = [{ name: "Home", path: "/" }];
  if (resolvedCategory) {
    jsonLdBreadcrumbs.push({ name: "Collections", path: "/collections" });
    for (const crumb of resolvedCategory.breadcrumbs) {
      jsonLdBreadcrumbs.push({
        name: crumb.name,
        path: `/collections/${crumb.path}`,
      });
    }
  } else {
    jsonLdBreadcrumbs.push({ name: "Collections", path: "/collections" });
  }

  const collectionJsonLd = buildCollectionJsonLd({
    name: collectionTitle,
    description: collectionDescription,
    path: basePath,
    items: result.items.map((p) => ({ name: p.name, slug: p.slug })),
  });
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(jsonLdBreadcrumbs);

  const breadcrumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
  if (resolvedCategory) {
    breadcrumbs.push({ label: "Collections", href: "/collections" });
    for (const crumb of resolvedCategory.breadcrumbs) {
      breadcrumbs.push({
        label: crumb.name,
        href: crumb.path === resolvedCategory.path ? undefined : `/collections/${crumb.path}`,
      });
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

  return (
    <Section spacing="sm">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <Container>
        <Breadcrumbs items={breadcrumbs} />

        <header className="mt-2 mb-8 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">
            {resolvedCategory ? "Curated Category" : "Complete Catalogue"}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            {resolvedCategory?.name ?? "All Jewellery"}
          </h1>
          {(resolvedCategory?.description ?? !resolvedCategory) && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {resolvedCategory?.description ??
                "Explore certified diamond solitaires, 18K gold bands, pendants, studs, and bracelets crafted for heirloom permanence."}
            </p>
          )}
          {subcategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link
                  key={sub.path}
                  href={`/collections/${sub.path}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent hover:bg-muted"
                >
                  <span>{sub.name}</span>
                  <span className="text-muted-foreground">({sub.productCount})</span>
                </Link>
              ))}
            </div>
          )}
        </header>

        <CollectionFilters
          facets={result.facets}
          totalCount={result.total}
          currentSort={filters.sort ?? "featured"}
          subcategories={subcategories}
        >
          {result.items.length === 0 ? (
            <EmptyState
              title="No Pieces Match Those Filters"
              description="Try widening your carat, metal, or price filters to inspect more creations in this collection."
              actionLabel="Reset Filters"
              actionHref={basePath}
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
                  buildHref={(page) => buildCatalogPageHref(basePath, rawSearch, page)}
                />
              </div>
            </>
          )}
        </CollectionFilters>

        <section
          aria-labelledby="collection-guidance-heading"
          className="mt-16 rounded-md border border-border bg-card p-6 sm:p-8"
        >
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="font-sans text-editorial-label text-accent-text">
                Gemological Provenance &amp; Craftsmanship
              </p>
              <h2
                id="collection-guidance-heading"
                className="mt-2 font-display text-2xl font-medium text-foreground"
              >
                Selecting Your {resolvedCategory?.name ?? "Fine Jewellery Piece"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Every {resolvedCategory ? resolvedCategory.name.toLowerCase() : "creation"} in the{" "}
                {settings.storeName} collection is hallmarked for 18K recycled gold or 950 platinum
                purity, independently graded where applicable by GIA or IGI laboratories, and
                dispatched with signature-required courier insurance and a{" "}
                {settings.returnWindowDays}-day return guarantee.
              </p>
            </div>
            {displayArticles.length > 0 && (
              <div className="lg:col-span-6">
                <p className="font-sans text-editorial-label text-accent-text">
                  Recommended Reading
                </p>
                <ul className="mt-3 space-y-2.5 text-sm">
                  {displayArticles.map((guide) => (
                    <li key={guide.id}>
                      <Link
                        href={`/guides/${guide.slug}`}
                        className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
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
        </section>
      </Container>
    </Section>
  );
}

export default function CollectionsPage(props: CollectionsPageProps) {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Loading collection…</div>
          </Container>
        </Section>
      }
    >
      <CollectionsBody {...props} />
    </Suspense>
  );
}
