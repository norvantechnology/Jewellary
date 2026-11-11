import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { PAGINATION_PAGE_SIZE } from "@/lib/constants";
import { getPublishedArticles, type ArticleDTO } from "@/modules/articles/article.service";
import { getActiveBanners, type BannerDTO } from "@/modules/banners/banner.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export interface PublicImageDTO {
  id: string;
  url: string;
  mediumUrl: string | null;
  thumbUrl: string | null;
  altText: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface PublicVariantSummaryDTO {
  id: string;
  sku: string;
  title: string;
  size: string | null;
  metal: string | null;
  stoneSpec: string | null;
  price: string;
  compareAtPrice: string | null;
  availableStock: number;
  lowStockThreshold: number;
  isDefault: boolean;
  weightGrams: string | null;
}

export interface PublicProductCardDTO {
  id: string;
  sku: string;
  name: string;
  slug: string;
  subtitle: string | null;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  compareAtPrice: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryPath: string;
  primaryImage: PublicImageDTO | null;
  secondaryImage: PublicImageDTO | null;
  metalType: string | null;
  metalColor: string | null;
  stoneShape: string | null;
  stoneOrigin: string | null;
  caratTotal: string | null;
  colorGrade: string | null;
  clarityGrade: string | null;
  cutGrade: string | null;
  certificationLab: string | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  hasSizing: boolean;
  leadTimeDays: number | null;
  defaultVariantId: string | null;
  totalAvailableStock: number;
}

export interface PublicProductDetailDTO extends PublicProductCardDTO {
  description: string | null;
  metalPurity: string | null;
  metalWeightGrams: string | null;
  caratCenter: string | null;
  polishGrade: string | null;
  symmetryGrade: string | null;
  fluorescence: string | null;
  certificateNumber: string | null;
  certificateUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalOverride: string | null;
  noindex: boolean;
  gtin: string | null;
  mpn: string | null;
  googleProductCategory: string | null;
  updatedAt: string;
  breadcrumbs: Array<{ name: string; path: string }>;
  images: PublicImageDTO[];
  variants: PublicVariantSummaryDTO[];
  attributes: Array<{
    facetCode: string;
    facetName: string;
    valueLabel: string;
    unit: string | null;
  }>;
}

export interface PublicCategoryNodeDTO {
  id: string;
  name: string;
  slug: string;
  path: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId: string | null;
  productCount: number;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    path: string;
    description: string | null;
    imageUrl: string | null;
    productCount: number;
  }>;
}

export type CollectionSortOption =
  "featured" | "price-asc" | "price-desc" | "newest" | "carat-desc";

export interface CollectionQueryInput {
  categoryPath?: string | null;
  metal?: string[];
  shape?: string[];
  origin?: string[];
  color?: string[];
  clarity?: string[];
  certification?: string[];
  minPrice?: number;
  maxPrice?: number;
  minCarat?: number;
  maxCarat?: number;
  inStock?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  bestseller?: boolean;
  sort?: CollectionSortOption;
  page?: number;
  pageSize?: number;
}

export interface FilterBucketOption {
  value: string;
  label: string;
  count: number;
}

export interface CollectionFacetsSummary {
  metals: FilterBucketOption[];
  shapes: FilterBucketOption[];
  origins: FilterBucketOption[];
  colors: FilterBucketOption[];
  clarities: FilterBucketOption[];
  certifications: FilterBucketOption[];
  priceBounds: { min: number; max: number };
  caratBounds: { min: number; max: number };
}

export interface CollectionQueryResult {
  items: PublicProductCardDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: CollectionFacetsSummary;
}

export interface HomepagePayloadDTO {
  banners: {
    hero: BannerDTO[];
    strip: BannerDTO[];
    editorial: BannerDTO[];
  };
  categories: PublicCategoryNodeDTO[];
  featuredProducts: PublicProductCardDTO[];
  newArrivals: PublicProductCardDTO[];
  bestsellers: PublicProductCardDTO[];
  articles: ArticleDTO[];
}

export const PUBLIC_PRODUCT_CARD_SELECT = {
  id: true,
  sku: true,
  name: true,
  slug: true,
  subtitle: true,
  priceMode: true,
  basePrice: true,
  compareAtPrice: true,
  metalType: true,
  metalColor: true,
  stoneShape: true,
  stoneOrigin: true,
  caratTotal: true,
  colorGrade: true,
  clarityGrade: true,
  cutGrade: true,
  certificationLab: true,
  isFeatured: true,
  isNewArrival: true,
  isBestseller: true,
  hasSizing: true,
  leadTimeDays: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    take: 2,
    select: {
      id: true,
      url: true,
      mediumUrl: true,
      thumbUrl: true,
      altText: true,
      width: true,
      height: true,
      isPrimary: true,
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" as const }, { sortOrder: "asc" as const }],
    select: {
      id: true,
      stockQty: true,
      reservedQty: true,
      isDefault: true,
    },
  },
} satisfies Prisma.ProductSelect;

type RawCardRow = Prisma.ProductGetPayload<{ select: typeof PUBLIC_PRODUCT_CARD_SELECT }>;

export function mapProductRowToCardDTO(row: RawCardRow): PublicProductCardDTO {
  const defaultVariant = row.variants.find((v) => v.isDefault) ?? row.variants[0] ?? null;
  const totalAvailableStock = row.variants.reduce(
    (sum, variant) => sum + Math.max(0, variant.stockQty - variant.reservedQty),
    0,
  );

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle,
    priceMode: row.priceMode,
    basePrice: row.basePrice.toString(),
    compareAtPrice: row.compareAtPrice?.toString() ?? null,
    categoryId: row.category.id,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    categoryPath: row.category.path,
    primaryImage: row.images[0] ?? null,
    secondaryImage: row.images[1] ?? null,
    metalType: row.metalType,
    metalColor: row.metalColor,
    stoneShape: row.stoneShape,
    stoneOrigin: row.stoneOrigin,
    caratTotal: row.caratTotal?.toString() ?? null,
    colorGrade: row.colorGrade,
    clarityGrade: row.clarityGrade,
    cutGrade: row.cutGrade,
    certificationLab: row.certificationLab,
    isFeatured: row.isFeatured,
    isNewArrival: row.isNewArrival,
    isBestseller: row.isBestseller,
    hasSizing: row.hasSizing,
    leadTimeDays: row.leadTimeDays,
    defaultVariantId: defaultVariant?.id ?? null,
    totalAvailableStock,
  };
}

export async function getAllActiveCategoriesTree(): Promise<PublicCategoryNodeDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.categories, CACHE_TAGS.products);

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      description: true,
      imageUrl: true,
      seoTitle: true,
      seoDescription: true,
      parentId: true,
      _count: {
        select: {
          products: {
            where: { status: "ACTIVE", deletedAt: null },
          },
        },
      },
    },
  });

  const childrenByParent = new Map<string, typeof categories>();
  for (const category of categories) {
    if (category.parentId) {
      const existing = childrenByParent.get(category.parentId) ?? [];
      existing.push(category);
      childrenByParent.set(category.parentId, existing);
    }
  }

  return categories
    .filter((c) => !c.parentId)
    .map((root) => {
      const children = (childrenByParent.get(root.id) ?? []).map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        path: child.path,
        description: child.description,
        imageUrl: child.imageUrl,
        productCount: child._count.products,
      }));
      const childrenTotal = children.reduce((sum, child) => sum + child.productCount, 0);

      return {
        id: root.id,
        name: root.name,
        slug: root.slug,
        path: root.path,
        description: root.description,
        imageUrl: root.imageUrl,
        seoTitle: root.seoTitle,
        seoDescription: root.seoDescription,
        parentId: null,
        productCount: root._count.products + childrenTotal,
        children,
      };
    });
}

export type CategoryResolutionResult =
  | {
      kind: "category";
      category: PublicCategoryNodeDTO & {
        breadcrumbs: Array<{ name: string; path: string }>;
        descendantIds: string[];
      };
    }
  | { kind: "redirect"; newPath: string }
  | null;

export async function resolveCategoryByPath(pathStr: string): Promise<CategoryResolutionResult> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.categories, CACHE_TAGS.products);

  const normalized = pathStr.replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;

  const category = await db.category.findFirst({
    where: { path: normalized, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      description: true,
      imageUrl: true,
      seoTitle: true,
      seoDescription: true,
      parentId: true,
    },
  });

  if (!category) {
    const redirect = await db.slugRedirect.findUnique({
      where: {
        entityType_oldSlug: {
          entityType: "category",
          oldSlug: normalized,
        },
      },
    });

    if (redirect) {
      return { kind: "redirect", newPath: redirect.newSlug };
    }

    if (!normalized.includes("/")) {
      const leafMatch = await db.category.findFirst({
        where: { slug: normalized, isActive: true },
        select: { path: true },
      });
      if (leafMatch && leafMatch.path !== normalized) {
        return { kind: "redirect", newPath: leafMatch.path };
      }
    }

    return null;
  }

  const allActive = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      description: true,
      imageUrl: true,
      parentId: true,
      _count: {
        select: {
          products: { where: { status: "ACTIVE", deletedAt: null } },
        },
      },
    },
  });

  const byId = new Map(allActive.map((item) => [item.id, item]));
  const breadcrumbs: Array<{ name: string; path: string }> = [];
  let cursor: (typeof allActive)[number] | undefined = byId.get(category.id);
  while (cursor) {
    breadcrumbs.unshift({ name: cursor.name, path: cursor.path });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  const descendants = allActive.filter(
    (item) => item.id === category.id || item.path.startsWith(`${category.path}/`),
  );
  const descendantIds = descendants.map((item) => item.id);
  const directChildren = descendants
    .filter((item) => item.parentId === category.id)
    .map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      path: child.path,
      description: child.description,
      imageUrl: child.imageUrl,
      productCount: child._count.products,
    }));

  const productCount = descendants.reduce((sum, item) => sum + item._count.products, 0);

  return {
    kind: "category",
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      path: category.path,
      description: category.description,
      imageUrl: category.imageUrl,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      parentId: category.parentId,
      productCount,
      children: directChildren,
      breadcrumbs,
      descendantIds,
    },
  };
}

function buildFilterBuckets(
  rows: Array<{
    metalType: string | null;
    stoneShape: string | null;
    stoneOrigin: string | null;
    colorGrade: string | null;
    clarityGrade: string | null;
    certificationLab: string | null;
    basePrice: Prisma.Decimal;
    caratTotal: Prisma.Decimal | null;
  }>,
): CollectionFacetsSummary {
  const countMap = (values: Array<string | null>): FilterBucketOption[] => {
    const counts = new Map<string, number>();
    for (const val of values) {
      const cleaned = val?.trim();
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

  for (const row of rows) {
    const price = Number(row.basePrice.toString());
    if (price > 0) {
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }
    if (row.caratTotal) {
      const carat = Number(row.caratTotal.toString());
      if (carat > 0) {
        if (carat < minCarat) minCarat = carat;
        if (carat > maxCarat) maxCarat = carat;
      }
    }
  }

  return {
    metals: countMap(rows.map((r) => r.metalType)),
    shapes: countMap(rows.map((r) => r.stoneShape)),
    origins: countMap(rows.map((r) => r.stoneOrigin)),
    colors: countMap(rows.map((r) => r.colorGrade)),
    clarities: countMap(rows.map((r) => r.clarityGrade)),
    certifications: countMap(rows.map((r) => r.certificationLab)),
    priceBounds: {
      min: Number.isFinite(minPrice) ? Math.floor(minPrice) : 0,
      max: maxPrice > 0 ? Math.ceil(maxPrice) : 25000,
    },
    caratBounds: {
      min: Number.isFinite(minCarat) ? Number(minCarat.toFixed(2)) : 0,
      max: maxCarat > 0 ? Number(maxCarat.toFixed(2)) : 5,
    },
  };
}

export async function queryCollectionProducts(
  input: CollectionQueryInput & { categoryIds?: string[] },
): Promise<CollectionQueryResult> {
  const pageSize = Math.min(48, Math.max(1, input.pageSize ?? PAGINATION_PAGE_SIZE));
  const page = Math.max(1, input.page ?? 1);

  let categoryIds = input.categoryIds;
  if (!categoryIds && input.categoryPath) {
    const resolved = await resolveCategoryByPath(input.categoryPath);
    if (resolved?.kind === "category") {
      categoryIds = resolved.category.descendantIds;
    }
  }

  const scopeWhere: Prisma.ProductWhereInput = {
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
    ...(input.featured ? { isFeatured: true } : {}),
    ...(input.newArrival ? { isNewArrival: true } : {}),
    ...(input.bestseller ? { isBestseller: true } : {}),
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

  if (input.inStock) {
    where.variants = {
      some: {
        isActive: true,
        stockQty: { gt: 0 },
      },
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    input.sort === "price-asc"
      ? [{ basePrice: "asc" }, { createdAt: "desc" }]
      : input.sort === "price-desc"
        ? [{ basePrice: "desc" }, { createdAt: "desc" }]
        : input.sort === "newest"
          ? [{ isNewArrival: "desc" }, { createdAt: "desc" }]
          : input.sort === "carat-desc"
            ? [{ caratTotal: { sort: "desc", nulls: "last" } }, { basePrice: "desc" }]
            : [{ isFeatured: "desc" }, { isBestseller: "desc" }, { createdAt: "desc" }];

  const [facetRows, matchedRows] = await Promise.all([
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
      orderBy,
      select: PUBLIC_PRODUCT_CARD_SELECT,
    }),
  ]);

  const cards = matchedRows.map(mapProductRowToCardDTO);
  const availabilityFiltered = input.inStock
    ? cards.filter((item) => item.totalAvailableStock > 0)
    : cards;

  const total = availabilityFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: availabilityFiltered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    facets: buildFilterBuckets(facetRows),
  };
}

export type PublicProductResolutionResult =
  | {
      kind: "product";
      product: PublicProductDetailDTO;
      relatedProducts: PublicProductCardDTO[];
    }
  | { kind: "redirect"; newSlug: string }
  | { kind: "redirect-category"; categoryPath: string }
  | null;

export async function getPublicProductBySlug(slug: string): Promise<PublicProductResolutionResult> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.productSlug(slug));

  const product = await db.product.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      subtitle: true,
      description: true,
      priceMode: true,
      basePrice: true,
      compareAtPrice: true,
      metalType: true,
      metalColor: true,
      metalPurity: true,
      metalWeightGrams: true,
      stoneOrigin: true,
      stoneShape: true,
      caratTotal: true,
      caratCenter: true,
      colorGrade: true,
      clarityGrade: true,
      cutGrade: true,
      polishGrade: true,
      symmetryGrade: true,
      fluorescence: true,
      certificationLab: true,
      certificateNumber: true,
      certificateUrl: true,
      isFeatured: true,
      isNewArrival: true,
      isBestseller: true,
      hasSizing: true,
      leadTimeDays: true,
      seoTitle: true,
      seoDescription: true,
      ogImageUrl: true,
      canonicalOverride: true,
      noindex: true,
      gtin: true,
      mpn: true,
      googleProductCategory: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          path: true,
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
              path: true,
            },
          },
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          url: true,
          mediumUrl: true,
          thumbUrl: true,
          altText: true,
          width: true,
          height: true,
          isPrimary: true,
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          sku: true,
          title: true,
          size: true,
          metal: true,
          stoneSpec: true,
          priceOverride: true,
          compareAtOverride: true,
          stockQty: true,
          reservedQty: true,
          lowStockThreshold: true,
          isDefault: true,
          weightGrams: true,
        },
      },
      facetValues: {
        select: {
          valueText: true,
          valueNumber: true,
          valueBoolean: true,
          facet: {
            select: {
              code: true,
              name: true,
              unit: true,
            },
          },
          option: {
            select: {
              label: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    const redirect = await db.slugRedirect.findUnique({
      where: {
        entityType_oldSlug: {
          entityType: "product",
          oldSlug: slug,
        },
      },
    });
    if (redirect) {
      return { kind: "redirect", newSlug: redirect.newSlug };
    }

    const archived = await db.product.findFirst({
      where: { slug, status: "ARCHIVED", deletedAt: null },
      select: { category: { select: { path: true } } },
    });
    if (archived?.category?.path) {
      return { kind: "redirect-category", categoryPath: archived.category.path };
    }

    return null;
  }

  const breadcrumbs: Array<{ name: string; path: string }> = [];
  if (product.category.parent) {
    breadcrumbs.push({
      name: product.category.parent.name,
      path: product.category.parent.path,
    });
  }
  breadcrumbs.push({
    name: product.category.name,
    path: product.category.path,
  });

  const mappedVariants: PublicVariantSummaryDTO[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    size: v.size,
    metal: v.metal,
    stoneSpec: v.stoneSpec,
    price: (v.priceOverride ?? product.basePrice).toString(),
    compareAtPrice: (v.compareAtOverride ?? product.compareAtPrice)?.toString() ?? null,
    availableStock: Math.max(0, v.stockQty - v.reservedQty),
    lowStockThreshold: v.lowStockThreshold,
    isDefault: v.isDefault,
    weightGrams: v.weightGrams?.toString() ?? null,
  }));

  const defaultVariant = mappedVariants.find((v) => v.isDefault) ?? mappedVariants[0] ?? null;
  const totalAvailableStock = mappedVariants.reduce((sum, v) => sum + v.availableStock, 0);

  const attributes = product.facetValues
    .map((fv) => {
      const valueLabel =
        fv.option?.label ??
        fv.valueText ??
        fv.valueNumber?.toString() ??
        (fv.valueBoolean !== null ? (fv.valueBoolean ? "Yes" : "No") : null);
      if (!valueLabel) return null;
      return {
        facetCode: fv.facet.code,
        facetName: fv.facet.name,
        valueLabel,
        unit: fv.facet.unit,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const relatedCategoryIds = [product.category.id];
  if (product.category.parent) {
    relatedCategoryIds.push(product.category.parent.id);
  }

  const relatedRows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      id: { not: product.id },
      categoryId: { in: relatedCategoryIds },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 4,
    select: PUBLIC_PRODUCT_CARD_SELECT,
  });

  return {
    kind: "product",
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      subtitle: product.subtitle,
      description: product.description,
      priceMode: product.priceMode,
      basePrice: product.basePrice.toString(),
      compareAtPrice: product.compareAtPrice?.toString() ?? null,
      categoryId: product.category.id,
      categoryName: product.category.name,
      categorySlug: product.category.slug,
      categoryPath: product.category.path,
      primaryImage: product.images[0] ?? null,
      secondaryImage: product.images[1] ?? null,
      metalType: product.metalType,
      metalColor: product.metalColor,
      metalPurity: product.metalPurity,
      metalWeightGrams: product.metalWeightGrams?.toString() ?? null,
      stoneOrigin: product.stoneOrigin,
      stoneShape: product.stoneShape,
      caratTotal: product.caratTotal?.toString() ?? null,
      caratCenter: product.caratCenter?.toString() ?? null,
      colorGrade: product.colorGrade,
      clarityGrade: product.clarityGrade,
      cutGrade: product.cutGrade,
      polishGrade: product.polishGrade,
      symmetryGrade: product.symmetryGrade,
      fluorescence: product.fluorescence,
      certificationLab: product.certificationLab,
      certificateNumber: product.certificateNumber,
      certificateUrl: product.certificateUrl,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      isBestseller: product.isBestseller,
      hasSizing: product.hasSizing,
      leadTimeDays: product.leadTimeDays,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      ogImageUrl: product.ogImageUrl,
      canonicalOverride: product.canonicalOverride,
      noindex: product.noindex,
      gtin: product.gtin,
      mpn: product.mpn,
      googleProductCategory: product.googleProductCategory,
      updatedAt: product.updatedAt.toISOString(),
      defaultVariantId: defaultVariant?.id ?? null,
      totalAvailableStock,
      breadcrumbs,
      images: product.images,
      variants: mappedVariants,
      attributes,
    },
    relatedProducts: relatedRows.map(mapProductRowToCardDTO),
  };
}

export async function getHomepagePayload(): Promise<HomepagePayloadDTO> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.banners, CACHE_TAGS.articles);

  const [banners, categories, featuredRows, newArrivalRows, bestsellerRows, articles] =
    await Promise.all([
      getActiveBanners(),
      getAllActiveCategoriesTree(),
      db.product.findMany({
        where: { status: "ACTIVE", deletedAt: null, isFeatured: true },
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        select: PUBLIC_PRODUCT_CARD_SELECT,
      }),
      db.product.findMany({
        where: { status: "ACTIVE", deletedAt: null, isNewArrival: true },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: PUBLIC_PRODUCT_CARD_SELECT,
      }),
      db.product.findMany({
        where: { status: "ACTIVE", deletedAt: null, isBestseller: true },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: PUBLIC_PRODUCT_CARD_SELECT,
      }),
      getPublishedArticles(),
    ]);

  return {
    banners: {
      hero: banners.filter((b) => b.position === "HERO"),
      strip: banners.filter((b) => b.position === "STRIP"),
      editorial: banners.filter((b) => b.position === "EDITORIAL"),
    },
    categories,
    featuredProducts: featuredRows.map(mapProductRowToCardDTO),
    newArrivals: newArrivalRows.map(mapProductRowToCardDTO),
    bestsellers: bestsellerRows.map(mapProductRowToCardDTO),
    articles: articles.slice(0, 3),
  };
}

export interface SitemapCategoryItem {
  path: string;
  imageUrl: string | null;
  updatedAt: Date;
}

export async function getSitemapCategories(): Promise<SitemapCategoryItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.categories);

  const rows = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      path: true,
      imageUrl: true,
      updatedAt: true,
    },
  });

  return rows;
}

export interface SitemapProductItem {
  slug: string;
  updatedAt: Date;
  images: string[];
}

export async function getSitemapProducts(skip = 0, take = 50000): Promise<SitemapProductItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      noindex: false,
      OR: [{ canonicalOverride: null }, { canonicalOverride: "" }],
    },
    orderBy: [{ updatedAt: "desc" }],
    skip,
    take,
    select: {
      slug: true,
      updatedAt: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: { url: true },
      },
    },
  });

  return rows.map((row) => ({
    slug: row.slug,
    updatedAt: row.updatedAt,
    images: row.images.map((i) => i.url),
  }));
}

export async function getActiveIndexableProductCount(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  return db.product.count({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      noindex: false,
      OR: [{ canonicalOverride: null }, { canonicalOverride: "" }],
    },
  });
}

export interface MerchantFeedItemDTO {
  id: string;
  itemGroupId: string;
  title: string;
  description: string;
  slug: string;
  imageUrl: string | null;
  additionalImageUrls: string[];
  availability: "in_stock" | "out_of_stock" | "preorder";
  price: string;
  gtin: string | null;
  mpn: string | null;
  googleProductCategory: string;
  productType: string;
  material: string | null;
  color: string | null;
  size: string | null;
  shippingWeightGrams: string | null;
}

export async function getMerchantFeedItems(): Promise<MerchantFeedItemDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.settings);

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      noindex: false,
      priceMode: "FIXED",
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      subtitle: true,
      description: true,
      basePrice: true,
      metalType: true,
      metalPurity: true,
      metalColor: true,
      metalWeightGrams: true,
      gtin: true,
      mpn: true,
      googleProductCategory: true,
      leadTimeDays: true,
      category: { select: { name: true, path: true } },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: { url: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        select: {
          sku: true,
          title: true,
          size: true,
          metal: true,
          priceOverride: true,
          stockQty: true,
          reservedQty: true,
          weightGrams: true,
        },
      },
    },
  });

  const items: MerchantFeedItemDTO[] = [];

  for (const product of products) {
    const primaryImage = product.images[0]?.url ?? null;
    const additionalImageUrls = product.images.slice(1, 10).map((img) => img.url);
    const description =
      product.description ??
      product.subtitle ??
      `${product.name} — independently certified fine jewellery crafted to heirloom tolerances.`;
    const defaultMaterial =
      [product.metalPurity, product.metalType].filter(Boolean).join(" ") || null;
    const googleCategory = product.googleProductCategory ?? "Apparel & Accessories > Jewelry";

    if (product.variants.length === 0) {
      items.push({
        id: product.sku,
        itemGroupId: product.sku,
        title: product.name,
        description,
        slug: product.slug,
        imageUrl: primaryImage,
        additionalImageUrls,
        availability: "out_of_stock",
        price: product.basePrice.toString(),
        gtin: product.gtin,
        mpn: product.mpn ?? product.sku,
        googleProductCategory: googleCategory,
        productType: product.category.name,
        material: defaultMaterial,
        color: product.metalColor,
        size: null,
        shippingWeightGrams: product.metalWeightGrams?.toString() ?? null,
      });
      continue;
    }

    for (const variant of product.variants) {
      const availQty = Math.max(0, variant.stockQty - variant.reservedQty);
      const availability: MerchantFeedItemDTO["availability"] =
        availQty > 0
          ? "in_stock"
          : product.leadTimeDays && product.leadTimeDays > 0
            ? "preorder"
            : "out_of_stock";

      items.push({
        id: variant.sku,
        itemGroupId: product.sku,
        title: variant.title ? `${product.name} — ${variant.title}` : product.name,
        description,
        slug: product.slug,
        imageUrl: primaryImage,
        additionalImageUrls,
        availability,
        price: (variant.priceOverride ?? product.basePrice).toString(),
        gtin: product.gtin,
        mpn: product.mpn ?? variant.sku,
        googleProductCategory: googleCategory,
        productType: product.category.name,
        material: variant.metal ?? defaultMaterial,
        color: product.metalColor,
        size: variant.size,
        shippingWeightGrams:
          variant.weightGrams?.toString() ?? product.metalWeightGrams?.toString() ?? null,
      });
    }
  }

  return items;
}
