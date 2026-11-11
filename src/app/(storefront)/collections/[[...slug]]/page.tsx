import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
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

export async function generateMetadata({ params }: CollectionsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathStr = slug?.join("/") ?? "";

  if (!pathStr) {
    return {
      title: "All Fine Jewellery Collections",
      description:
        "Browse GIA and IGI certified engagement rings, wedding bands, diamond pendants, earrings, and tennis bracelets.",
    };
  }

  const resolved = await resolveCategoryByPath(pathStr);
  if (!resolved || resolved.kind !== "category") {
    return { title: "Collection" };
  }

  return {
    title: resolved.category.seoTitle ?? resolved.category.name,
    description:
      resolved.category.seoDescription ??
      resolved.category.description ??
      `Explore ${resolved.category.name} crafted in 18K recycled gold and platinum.`,
  };
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
  const result = await queryCollectionProducts({
    ...filters,
    categoryPath: pathStr || null,
    categoryIds: resolvedCategory?.descendantIds,
  });

  const basePath = pathStr ? `/collections/${pathStr}` : "/collections";
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
