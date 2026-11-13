import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { PAGINATION_PAGE_SIZE, SEARCH_SUGGEST_LIMIT } from "@/lib/constants";
import {
  mapProductRowToCardDTO,
  PUBLIC_PRODUCT_CARD_SELECT,
  queryCollectionProducts,
  resolveCategoryByPath,
  type CollectionFacetsSummary,
  type CollectionQueryInput,
  type PublicProductCardDTO,
} from "@/modules/catalog/catalog.public";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export interface SearchQueryInput extends CollectionQueryInput {
  q?: string;
}

export interface SearchResult {
  query: string;
  items: PublicProductCardDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: CollectionFacetsSummary;
  matchedBy: "fts-trgm" | "browse";
}

export interface SearchSuggestResponse {
  query: string;
  categories: Array<{
    id: string;
    name: string;
    path: string;
    productCount: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    categoryName: string;
    priceMode: "FIXED" | "PRICE_ON_REQUEST";
    basePrice: string;
    imageUrl: string | null;
    altText: string | null;
  }>;
  guides: Array<{
    id: string;
    title: string;
    slug: string;
    authorName: string;
  }>;
}

function sanitizeSearchTerm(raw?: string): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, 100);
}

interface RankedIdRow {
  id: string;
  score: number;
}

async function rankMatchingProductIds(term: string): Promise<RankedIdRow[]> {
  const containsPattern = `%${term}%`;
  const lowerContainsPattern = `%${term.toLowerCase()}%`;

  const indexedRows = await db.$queryRaw<Array<{ id: string; score: number }>>(Prisma.sql`
    SELECT
      id,
      GREATEST(
        COALESCE(ts_rank_cd("searchVector", websearch_to_tsquery('english', unaccent(${term}))), 0) * 2.0,
        similarity(name, ${term}),
        similarity(sku, ${term}) * 1.2,
        word_similarity(${term}, name) * 0.9,
        CASE
          WHEN name ILIKE ${containsPattern} OR sku ILIKE ${containsPattern}
            THEN 0.85
          ELSE 0
        END
      )::float8 AS score
    FROM "Product"
    WHERE status = 'ACTIVE'
      AND "deletedAt" IS NULL
      AND (
        "searchVector" @@ websearch_to_tsquery('english', unaccent(${term}))
        OR name ILIKE ${containsPattern}
        OR sku ILIKE ${containsPattern}
        OR ${term} <% name
      )
    ORDER BY score DESC, "isFeatured" DESC, "createdAt" DESC
    LIMIT 200
  `);

  if (indexedRows.length >= 10) {
    return indexedRows;
  }

  // Typo & non-indexed attribute fallback when strict GIN candidates are sparse
  const fallbackRows = await db.$queryRaw<Array<{ id: string; score: number }>>(Prisma.sql`
    SELECT
      id,
      GREATEST(
        COALESCE(ts_rank_cd("searchVector", websearch_to_tsquery('english', unaccent(${term}))), 0) * 2.0,
        similarity(lower(name), lower(${term})),
        similarity(lower(sku), lower(${term})) * 1.2,
        CASE
          WHEN lower(name) LIKE ${lowerContainsPattern} OR lower(sku) LIKE ${lowerContainsPattern}
            THEN 0.85
          ELSE 0
        END
      )::float8 AS score
    FROM "Product"
    WHERE status = 'ACTIVE'
      AND "deletedAt" IS NULL
      AND (
        "searchVector" @@ websearch_to_tsquery('english', unaccent(${term}))
        OR similarity(lower(name), lower(${term})) >= 0.16
        OR similarity(lower(sku), lower(${term})) >= 0.25
        OR lower(name) LIKE ${lowerContainsPattern}
        OR lower(sku) LIKE ${lowerContainsPattern}
        OR lower(coalesce("subtitle", '')) LIKE ${lowerContainsPattern}
        OR lower(coalesce("metalType", '')) LIKE ${lowerContainsPattern}
        OR lower(coalesce("stoneShape", '')) LIKE ${lowerContainsPattern}
        OR lower(coalesce("certificationLab", '')) LIKE ${lowerContainsPattern}
      )
    ORDER BY score DESC, "isFeatured" DESC, "createdAt" DESC
    LIMIT 200
  `);

  return fallbackRows;
}

export async function searchProducts(input: SearchQueryInput): Promise<SearchResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.facets);

  const query = sanitizeSearchTerm(input.q);
  const pageSize = Math.min(48, Math.max(1, input.pageSize ?? PAGINATION_PAGE_SIZE));
  const page = Math.max(1, input.page ?? 1);

  if (!query) {
    const browse = await queryCollectionProducts({ ...input, page, pageSize });
    return {
      query: "",
      ...browse,
      matchedBy: "browse",
    };
  }

  const [ranked, resolvedCategory, inStockIds] = await Promise.all([
    rankMatchingProductIds(query),
    input.categoryPath ? resolveCategoryByPath(input.categoryPath) : Promise.resolve(null),
    input.inStock
      ? db.$queryRaw<Array<{ productId: string }>>`
          SELECT DISTINCT "productId"
          FROM "ProductVariant"
          WHERE "isActive" = true AND "stockQty" > "reservedQty"
        `.then((rows) => rows.map((r) => r.productId))
      : Promise.resolve(undefined),
  ]);

  if (ranked.length === 0) {
    return {
      query,
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      matchedBy: "fts-trgm",
      facets: {
        metals: [],
        shapes: [],
        origins: [],
        colors: [],
        clarities: [],
        certifications: [],
        priceBounds: { min: 0, max: 25000 },
        caratBounds: { min: 0, max: 5 },
      },
    };
  }

  const scoreOrder = new Map<string, number>();
  ranked.forEach((row, index) => {
    scoreOrder.set(row.id, index);
  });
  let matchedIds = ranked.map((r) => r.id);
  if (inStockIds) {
    const inStockSet = new Set(inStockIds);
    matchedIds = matchedIds.filter((id) => inStockSet.has(id));
  }

  const categoryIds =
    resolvedCategory?.kind === "category" ? resolvedCategory.category.descendantIds : undefined;

  const scopeWhere: Prisma.ProductWhereInput = {
    id: { in: matchedIds },
    status: "ACTIVE",
    deletedAt: null,
    ...(categoryIds && categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
  };

  const where: Prisma.ProductWhereInput = {
    ...scopeWhere,
    ...(input.metal && input.metal.length > 0 ? { metalType: { in: input.metal } } : {}),
    ...(input.shape && input.shape.length > 0 ? { stoneShape: { in: input.shape } } : {}),
    ...(input.origin && input.origin.length > 0 ? { stoneOrigin: { in: input.origin } } : {}),
    ...(input.color && input.color.length > 0 ? { colorGrade: { in: input.color } } : {}),
    ...(input.clarity && input.clarity.length > 0 ? { clarityGrade: { in: input.clarity } } : {}),
    ...(input.certification && input.certification.length > 0
      ? { certificationLab: { in: input.certification } }
      : {}),
  };

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.basePrice = {
      ...(input.minPrice !== undefined ? { gte: new Prisma.Decimal(input.minPrice) } : {}),
      ...(input.maxPrice !== undefined ? { lte: new Prisma.Decimal(input.maxPrice) } : {}),
    };
  }

  if (input.minCarat !== undefined || input.maxCarat !== undefined) {
    where.caratTotal = {
      ...(input.minCarat !== undefined ? { gte: new Prisma.Decimal(input.minCarat) } : {}),
      ...(input.maxCarat !== undefined ? { lte: new Prisma.Decimal(input.maxCarat) } : {}),
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    input.sort === "price-asc"
      ? [{ basePrice: "asc" }]
      : input.sort === "price-desc"
        ? [{ basePrice: "desc" }]
        : input.sort === "newest"
          ? [{ createdAt: "desc" }]
          : input.sort === "carat-desc"
            ? [{ caratTotal: { sort: "desc", nulls: "last" } }]
            : [];

  const [facetRows, matchedIdRows] = await Promise.all([
    db.product.findMany({
      where: scopeWhere,
      select: {
        metalType: true,
        stoneShape: true,
        stoneOrigin: true,
        colorGrade: true,
        clarityGrade: true,
        certificationLab: true,
        basePrice: true,
        caratTotal: true,
      },
    }),
    db.product.findMany({
      where,
      ...(orderBy.length > 0 ? { orderBy } : {}),
      select: { id: true },
    }),
  ]);

  const orderedIds = matchedIdRows.map((r) => r.id);
  if (!input.sort || input.sort === "featured") {
    orderedIds.sort((a, b) => (scoreOrder.get(a) ?? 9999) - (scoreOrder.get(b) ?? 9999));
  }

  const total = orderedIds.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageIds = orderedIds.slice(start, start + pageSize);

  const pageRows =
    pageIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: pageIds } },
          select: PUBLIC_PRODUCT_CARD_SELECT,
        })
      : [];

  const pagePos = new Map(pageIds.map((id, idx) => [id, idx]));
  const cards = pageRows
    .map(mapProductRowToCardDTO)
    .sort((a, b) => (pagePos.get(a.id) ?? 9999) - (pagePos.get(b.id) ?? 9999));

  const countMap = (values: Array<string | null>) => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const cleaned = v?.trim();
      if (!cleaned) continue;
      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  };

  let minPrice = Infinity;
  let maxPrice = 0;
  let minCarat = Infinity;
  let maxCarat = 0;
  for (const row of facetRows) {
    const p = Number(row.basePrice.toString());
    if (p > 0) {
      if (p < minPrice) minPrice = p;
      if (p > maxPrice) maxPrice = p;
    }
    if (row.caratTotal) {
      const c = Number(row.caratTotal.toString());
      if (c > 0) {
        if (c < minCarat) minCarat = c;
        if (c > maxCarat) maxCarat = c;
      }
    }
  }

  return {
    query,
    items: cards,
    total,
    page: safePage,
    pageSize,
    totalPages,
    matchedBy: "fts-trgm",
    facets: {
      metals: countMap(facetRows.map((r) => r.metalType)),
      shapes: countMap(facetRows.map((r) => r.stoneShape)),
      origins: countMap(facetRows.map((r) => r.stoneOrigin)),
      colors: countMap(facetRows.map((r) => r.colorGrade)),
      clarities: countMap(facetRows.map((r) => r.clarityGrade)),
      certifications: countMap(facetRows.map((r) => r.certificationLab)),
      priceBounds: {
        min: Number.isFinite(minPrice) ? Math.floor(minPrice) : 0,
        max: maxPrice > 0 ? Math.ceil(maxPrice) : 25000,
      },
      caratBounds: {
        min: Number.isFinite(minCarat) ? Number(minCarat.toFixed(2)) : 0,
        max: maxCarat > 0 ? Number(maxCarat.toFixed(2)) : 5,
      },
    },
  };
}

export async function getSearchSuggestions(
  rawQuery: string,
  limit = SEARCH_SUGGEST_LIMIT,
): Promise<SearchSuggestResponse> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.articles);

  const query = sanitizeSearchTerm(rawQuery);
  const clampedLimit = Math.min(12, Math.max(1, limit));

  if (query.length < 2) {
    const [topCategories, topGuides] = await Promise.all([
      db.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          path: true,
          _count: {
            select: { products: { where: { status: "ACTIVE", deletedAt: null } } },
          },
        },
      }),
      db.article.findMany({
        where: { isPublished: true },
        orderBy: [{ publishedAt: "desc" }],
        take: 3,
        select: { id: true, title: true, slug: true, authorName: true },
      }),
    ]);
    return {
      query,
      categories: topCategories.map((c) => ({
        id: c.id,
        name: c.name,
        path: c.path,
        productCount: c._count.products,
      })),
      products: [],
      guides: topGuides,
    };
  }

  const [rankedIds, matchedCategories, matchedGuides] = await Promise.all([
    rankMatchingProductIds(query),
    db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }],
      take: 4,
      select: {
        id: true,
        name: true,
        path: true,
        _count: {
          select: { products: { where: { status: "ACTIVE", deletedAt: null } } },
        },
      },
    }),
    db.article.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { excerpt: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 3,
      select: { id: true, title: true, slug: true, authorName: true },
    }),
  ]);

  const topIds = rankedIds.slice(0, clampedLimit).map((r) => r.id);
  const products =
    topIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: topIds }, status: "ACTIVE", deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            priceMode: true,
            basePrice: true,
            category: { select: { name: true } },
            images: {
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
              select: { thumbUrl: true, url: true, altText: true },
            },
          },
        })
      : [];

  const orderMap = new Map(topIds.map((id, idx) => [id, idx]));
  products.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));

  return {
    query,
    categories: matchedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      path: c.path,
      productCount: c._count.products,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      categoryName: p.category.name,
      priceMode: p.priceMode,
      basePrice: p.basePrice.toString(),
      imageUrl: p.images[0]?.thumbUrl ?? p.images[0]?.url ?? null,
      altText: p.images[0]?.altText ?? null,
    })),
    guides: matchedGuides,
  };
}
