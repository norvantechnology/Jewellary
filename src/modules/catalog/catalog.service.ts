import "server-only";
import { Prisma, type InventoryReason, type ProductStatus } from "@/generated/prisma/client";
import { buildCategoryPath, slugify } from "@/lib/slug";
import type {
  AdjustStockInput,
  CategoryUpsertInput,
  FacetUpsertInput,
  ProductUpsertInput,
} from "@/modules/catalog/catalog.schemas";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export interface AdminCategoryDTO {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  facetIds: string[];
}

export interface AdminFacetDTO {
  id: string;
  code: string;
  name: string;
  valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "RANGE";
  isFilterable: boolean;
  sortOrder: number;
  unit: string | null;
  options: Array<{
    id: string;
    value: string;
    label: string;
    sortOrder: number;
    swatchHex: string | null;
  }>;
  categoryCount: number;
  productCount: number;
}

export interface AdminProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: ProductStatus;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  categoryName: string;
  categoryId: string;
  primaryImageUrl: string | null;
  primaryAltText: string | null;
  variantCount: number;
  availableStock: number;
  lowStock: boolean;
  isFeatured: boolean;
  updatedAt: string;
}

export interface AdminProductDetailDTO {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: ProductStatus;
  categoryId: string;
  subtitle: string | null;
  description: string | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  hasSizing: boolean;
  leadTimeDays: number | null;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  metalType: string | null;
  metalColor: string | null;
  metalPurity: string | null;
  metalWeightGrams: string | null;
  stoneOrigin: string | null;
  stoneShape: string | null;
  caratTotal: string | null;
  caratCenter: string | null;
  colorGrade: string | null;
  clarityGrade: string | null;
  cutGrade: string | null;
  polishGrade: string | null;
  symmetryGrade: string | null;
  fluorescence: string | null;
  certificationLab: string | null;
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
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    size: string | null;
    metal: string | null;
    stoneSpec: string | null;
    priceOverride: string | null;
    compareAtOverride: string | null;
    stockQty: number;
    reservedQty: number;
    lowStockThreshold: number;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
    weightGrams: string | null;
  }>;
  images: Array<{
    id: string;
    storageKey: string;
    url: string;
    thumbUrl: string | null;
    mediumUrl: string | null;
    altText: string;
    width: number;
    height: number;
    focalX: number | null;
    focalY: number | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  facetValues: Array<{
    facetId: string;
    optionId: string | null;
    valueText: string | null;
    valueNumber: string | null;
    valueBoolean: boolean | null;
  }>;
}

export interface AdminInventoryRowDTO {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: ProductStatus;
  sku: string;
  title: string;
  stockQty: number;
  reservedQty: number;
  availableQty: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isActive: boolean;
}

export interface InventoryTransactionDTO {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  productName: string;
  reason: InventoryReason;
  delta: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface AdminDashboardSummary {
  activeProducts: number;
  draftProducts: number;
  categoriesCount: number;
  facetsCount: number;
  lowStockVariantsCount: number;
  ordersCount: number;
  newEnquiriesCount: number;
  publishedArticlesCount: number;
  activeBannersCount: number;
  lowStockAlerts: AdminInventoryRowDTO[];
}

function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toDecimalOrNull(value: string | null | undefined): Prisma.Decimal | null {
  if (!value) return null;
  return new Prisma.Decimal(value);
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const [
    activeProducts,
    draftProducts,
    categoriesCount,
    facetsCount,
    ordersCount,
    newEnquiriesCount,
    publishedArticlesCount,
    activeBannersCount,
    activeVariants,
  ] = await Promise.all([
    db.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.product.count({ where: { deletedAt: null, status: "DRAFT" } }),
    db.category.count(),
    db.facet.count(),
    db.order.count(),
    db.enquiry.count({ where: { status: "NEW" } }),
    db.article.count({ where: { isPublished: true } }),
    db.banner.count({ where: { isActive: true } }),
    db.productVariant.findMany({
      where: {
        isActive: true,
        product: { deletedAt: null },
      },
      include: {
        product: { select: { id: true, name: true, slug: true, status: true } },
      },
      orderBy: [{ stockQty: "asc" }, { updatedAt: "desc" }],
      take: 50,
    }),
  ]);

  const lowStockAlerts: AdminInventoryRowDTO[] = [];
  for (const v of activeVariants) {
    const availableQty = v.stockQty - v.reservedQty;
    if (availableQty <= v.lowStockThreshold) {
      lowStockAlerts.push({
        id: v.id,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        productStatus: v.product.status,
        sku: v.sku,
        title: v.title,
        stockQty: v.stockQty,
        reservedQty: v.reservedQty,
        availableQty,
        lowStockThreshold: v.lowStockThreshold,
        isLowStock: true,
        isActive: v.isActive,
      });
    }
  }

  return {
    activeProducts,
    draftProducts,
    categoriesCount,
    facetsCount,
    lowStockVariantsCount: lowStockAlerts.length,
    ordersCount,
    newEnquiriesCount,
    publishedArticlesCount,
    activeBannersCount,
    lowStockAlerts: lowStockAlerts.slice(0, 10),
  };
}

export async function listAdminCategories(): Promise<AdminCategoryDTO[]> {
  const rows = await db.category.findMany({
    include: {
      parent: { select: { name: true } },
      facetLinks: { select: { facetId: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true, children: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    path: row.path,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    description: row.description,
    imageUrl: row.imageUrl,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: row._count.products,
    childCount: row._count.children,
    facetIds: row.facetLinks.map((link) => link.facetId),
  }));
}

export async function upsertCategory(rawInput: CategoryUpsertInput) {
  const slug = slugify(rawInput.slug || rawInput.name);
  if (!slug) {
    throw new ValidationError("Unable to derive a valid URL slug from the category name.", {
      slug: ["Enter at least two alphanumeric characters."],
    });
  }

  if (rawInput.id && rawInput.parentId === rawInput.id) {
    throw new ValidationError("A category cannot be its own parent.", {
      parentId: ["Choose a different parent category or leave empty."],
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      let parentPath: string | null = null;
      if (rawInput.parentId) {
        const parent = await tx.category.findUnique({ where: { id: rawInput.parentId } });
        if (!parent) {
          throw new NotFoundError("Selected parent category does not exist.");
        }
        // Prevent cycles when moving an existing category under one of its own descendants
        if (rawInput.id) {
          let cursorId: string | null = parent.parentId;
          while (cursorId) {
            if (cursorId === rawInput.id) {
              throw new ValidationError(
                "Moving a category under its own descendant creates a loop.",
                {
                  parentId: ["Select a non-descendant parent category."],
                },
              );
            }
            const ancestor = await tx.category.findUnique({
              where: { id: cursorId },
              select: { parentId: true },
            });
            cursorId = ancestor?.parentId ?? null;
          }
        }
        parentPath = parent.path;
      }

      const newPath = buildCategoryPath(slug, parentPath);
      const uniqueFacetIds = Array.from(new Set(rawInput.facetIds ?? []));

      if (rawInput.id) {
        const existing = await tx.category.findUnique({ where: { id: rawInput.id } });
        if (!existing) {
          throw new NotFoundError("Category not found.");
        }

        const oldPath = existing.path;
        const updated = await tx.category.update({
          where: { id: rawInput.id },
          data: {
            name: rawInput.name,
            slug,
            path: newPath,
            parentId: rawInput.parentId ?? null,
            description: rawInput.description ?? null,
            imageUrl: rawInput.imageUrl ?? null,
            seoTitle: rawInput.seoTitle ?? null,
            seoDescription: rawInput.seoDescription ?? null,
            sortOrder: rawInput.sortOrder ?? 0,
            isActive: rawInput.isActive ?? true,
          },
        });

        await tx.categoryFacet.deleteMany({ where: { categoryId: updated.id } });
        if (uniqueFacetIds.length > 0) {
          await tx.categoryFacet.createMany({
            data: uniqueFacetIds.map((facetId, idx) => ({
              categoryId: updated.id,
              facetId,
              sortOrder: idx,
            })),
          });
        }

        if (oldPath !== newPath) {
          await tx.slugRedirect.upsert({
            where: { entityType_oldSlug: { entityType: "category", oldSlug: oldPath } },
            update: { newSlug: newPath },
            create: { entityType: "category", oldSlug: oldPath, newSlug: newPath },
          });

          const descendants = await tx.category.findMany({
            where: { path: { startsWith: `${oldPath}/` } },
          });
          for (const child of descendants) {
            const childNewPath = `${newPath}${child.path.slice(oldPath.length)}`;
            await tx.category.update({
              where: { id: child.id },
              data: { path: childNewPath },
            });
            await tx.slugRedirect.upsert({
              where: { entityType_oldSlug: { entityType: "category", oldSlug: child.path } },
              update: { newSlug: childNewPath },
              create: { entityType: "category", oldSlug: child.path, newSlug: childNewPath },
            });
          }
        }

        return { id: updated.id, slug: updated.slug, path: updated.path };
      }

      const created = await tx.category.create({
        data: {
          name: rawInput.name,
          slug,
          path: newPath,
          parentId: rawInput.parentId ?? null,
          description: rawInput.description ?? null,
          imageUrl: rawInput.imageUrl ?? null,
          seoTitle: rawInput.seoTitle ?? null,
          seoDescription: rawInput.seoDescription ?? null,
          sortOrder: rawInput.sortOrder ?? 0,
          isActive: rawInput.isActive ?? true,
        },
      });

      if (uniqueFacetIds.length > 0) {
        await tx.categoryFacet.createMany({
          data: uniqueFacetIds.map((facetId, idx) => ({
            categoryId: created.id,
            facetId,
            sortOrder: idx,
          })),
        });
      }

      return { id: created.id, slug: created.slug, path: created.path };
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError("A category with that slug or hierarchy path already exists.");
    }
    throw error;
  }
}

export async function deleteCategory(id: string) {
  const existing = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) {
    throw new NotFoundError("Category not found.");
  }
  if (existing._count.products > 0) {
    throw new ConflictError(
      `Cannot delete "${existing.name}" because ${existing._count.products} product(s) belong to it. Reassign those products first.`,
    );
  }
  if (existing._count.children > 0) {
    throw new ConflictError(
      `Cannot delete "${existing.name}" while it has sub-categories. Remove or re-parent children first.`,
    );
  }

  await db.category.delete({ where: { id } });
  return { id, path: existing.path };
}

export async function listAdminFacets(): Promise<AdminFacetDTO[]> {
  const rows = await db.facet.findMany({
    include: {
      options: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
      _count: { select: { categoryLinks: true, productValues: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    valueType: row.valueType,
    isFilterable: row.isFilterable,
    sortOrder: row.sortOrder,
    unit: row.unit,
    options: row.options.map((opt) => ({
      id: opt.id,
      value: opt.value,
      label: opt.label,
      sortOrder: opt.sortOrder,
      swatchHex: opt.swatchHex,
    })),
    categoryCount: row._count.categoryLinks,
    productCount: row._count.productValues,
  }));
}

export async function upsertFacet(rawInput: FacetUpsertInput) {
  const code = rawInput.code.trim().toLowerCase();
  const options = rawInput.options ?? [];

  try {
    return await db.$transaction(async (tx) => {
      if (rawInput.id) {
        const existing = await tx.facet.findUnique({
          where: { id: rawInput.id },
          include: { options: true },
        });
        if (!existing) throw new NotFoundError("Facet attribute not found.");

        const updated = await tx.facet.update({
          where: { id: existing.id },
          data: {
            code,
            name: rawInput.name,
            valueType: rawInput.valueType ?? "TEXT",
            isFilterable: rawInput.isFilterable ?? true,
            sortOrder: rawInput.sortOrder ?? 0,
            unit: rawInput.unit ?? null,
          },
        });

        const keepIds = new Set(
          options
            .map((o) => o.id)
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        );
        const toDeleteIds = existing.options
          .filter((opt) => !keepIds.has(opt.id))
          .map((opt) => opt.id);

        if (toDeleteIds.length > 0) {
          await tx.facetOption.deleteMany({
            where: { id: { in: toDeleteIds }, facetId: existing.id },
          });
        }

        for (let idx = 0; idx < options.length; idx += 1) {
          const opt = options[idx]!;
          if (opt.id && existing.options.some((e) => e.id === opt.id)) {
            await tx.facetOption.update({
              where: { id: opt.id },
              data: {
                value: opt.value,
                label: opt.label,
                sortOrder: opt.sortOrder ?? idx,
                swatchHex: opt.swatchHex ?? null,
              },
            });
          } else {
            await tx.facetOption.create({
              data: {
                facetId: existing.id,
                value: opt.value,
                label: opt.label,
                sortOrder: opt.sortOrder ?? idx,
                swatchHex: opt.swatchHex ?? null,
              },
            });
          }
        }

        return { id: updated.id, code: updated.code };
      }

      const created = await tx.facet.create({
        data: {
          code,
          name: rawInput.name,
          valueType: rawInput.valueType ?? "TEXT",
          isFilterable: rawInput.isFilterable ?? true,
          sortOrder: rawInput.sortOrder ?? 0,
          unit: rawInput.unit ?? null,
          options: {
            create: options.map((opt, idx) => ({
              value: opt.value,
              label: opt.label,
              sortOrder: opt.sortOrder ?? idx,
              swatchHex: opt.swatchHex ?? null,
            })),
          },
        },
      });

      return { id: created.id, code: created.code };
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError("Facet code or option value already exists.");
    }
    throw error;
  }
}

export async function deleteFacet(id: string) {
  const existing = await db.facet.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Facet attribute not found.");
  await db.facet.delete({ where: { id } });
  return { id, code: existing.code };
}

export async function listAdminProducts(params: {
  search?: string;
  status?: ProductStatus | "ALL";
  categoryId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize ?? 20));
  const search = params.search?.trim();

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        variants: {
          where: { isActive: true },
          select: { stockQty: true, reservedQty: true, lowStockThreshold: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items: AdminProductListItem[] = rows.map((p) => {
    const availableStock = p.variants.reduce(
      (sum, v) => sum + Math.max(0, v.stockQty - v.reservedQty),
      0,
    );
    const lowStock = p.variants.some((v) => v.stockQty - v.reservedQty <= v.lowStockThreshold);

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      status: p.status,
      priceMode: p.priceMode,
      basePrice: p.basePrice.toFixed(2),
      categoryName: p.category.name,
      categoryId: p.categoryId,
      primaryImageUrl: p.images[0]?.thumbUrl ?? p.images[0]?.url ?? null,
      primaryAltText: p.images[0]?.altText ?? null,
      variantCount: p.variants.length,
      availableStock,
      lowStock,
      isFeatured: p.isFeatured,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminProductById(id: string): Promise<AdminProductDetailDTO> {
  const p = await db.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      facetValues: true,
    },
  });

  if (!p) {
    throw new NotFoundError("Product not found.");
  }

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    status: p.status,
    categoryId: p.categoryId,
    subtitle: p.subtitle,
    description: p.description,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBestseller: p.isBestseller,
    hasSizing: p.hasSizing,
    leadTimeDays: p.leadTimeDays,
    priceMode: p.priceMode,
    basePrice: p.basePrice.toFixed(2),
    compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toFixed(2) : null,
    costPrice: p.costPrice ? p.costPrice.toFixed(2) : null,
    metalType: p.metalType,
    metalColor: p.metalColor,
    metalPurity: p.metalPurity,
    metalWeightGrams: p.metalWeightGrams ? p.metalWeightGrams.toFixed(2) : null,
    stoneOrigin: p.stoneOrigin,
    stoneShape: p.stoneShape,
    caratTotal: p.caratTotal ? p.caratTotal.toFixed(2) : null,
    caratCenter: p.caratCenter ? p.caratCenter.toFixed(2) : null,
    colorGrade: p.colorGrade,
    clarityGrade: p.clarityGrade,
    cutGrade: p.cutGrade,
    polishGrade: p.polishGrade,
    symmetryGrade: p.symmetryGrade,
    fluorescence: p.fluorescence,
    certificationLab: p.certificationLab,
    certificateNumber: p.certificateNumber,
    certificateUrl: p.certificateUrl,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImageUrl: p.ogImageUrl,
    canonicalOverride: p.canonicalOverride,
    noindex: p.noindex,
    gtin: p.gtin,
    mpn: p.mpn,
    googleProductCategory: p.googleProductCategory,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      size: v.size,
      metal: v.metal,
      stoneSpec: v.stoneSpec,
      priceOverride: v.priceOverride ? v.priceOverride.toFixed(2) : null,
      compareAtOverride: v.compareAtOverride ? v.compareAtOverride.toFixed(2) : null,
      stockQty: v.stockQty,
      reservedQty: v.reservedQty,
      lowStockThreshold: v.lowStockThreshold,
      isDefault: v.isDefault,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
      weightGrams: v.weightGrams ? v.weightGrams.toFixed(2) : null,
    })),
    images: p.images.map((img) => ({
      id: img.id,
      storageKey: img.storageKey,
      url: img.url,
      thumbUrl: img.thumbUrl,
      mediumUrl: img.mediumUrl,
      altText: img.altText,
      width: img.width,
      height: img.height,
      focalX: img.focalX,
      focalY: img.focalY,
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
    })),
    facetValues: p.facetValues.map((fv) => ({
      facetId: fv.facetId,
      optionId: fv.optionId,
      valueText: fv.valueText,
      valueNumber: fv.valueNumber ? fv.valueNumber.toString() : null,
      valueBoolean: fv.valueBoolean,
    })),
  };
}

export async function upsertProduct(rawInput: ProductUpsertInput, actorId: string | null) {
  const slug = slugify(rawInput.slug || rawInput.name);
  if (!slug) {
    throw new ValidationError("Unable to derive a valid product slug.", {
      slug: ["Enter at least two alphanumeric characters."],
    });
  }

  const variants = [...rawInput.variants];
  const defaultIndex = Math.max(
    0,
    variants.findIndex((v) => v.isDefault),
  );
  const normalizedVariants = variants.map((v, idx) => ({
    ...v,
    isDefault: idx === defaultIndex,
    sortOrder: v.sortOrder ?? idx,
  }));

  const images = [...(rawInput.images ?? [])];
  const primaryImageIdx =
    images.length > 0
      ? Math.max(
          0,
          images.findIndex((i) => i.isPrimary),
        )
      : -1;
  const normalizedImages = images.map((img, idx) => ({
    ...img,
    isPrimary: idx === primaryImageIdx,
    sortOrder: idx,
  }));

  try {
    return await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: rawInput.categoryId } });
      if (!category) {
        throw new NotFoundError("Selected category does not exist.");
      }

      const scalarData = {
        sku: rawInput.sku.trim(),
        name: rawInput.name.trim(),
        slug,
        status: rawInput.status ?? "DRAFT",
        categoryId: rawInput.categoryId,
        subtitle: rawInput.subtitle ?? null,
        description: rawInput.description ?? null,
        priceMode: rawInput.priceMode ?? "FIXED",
        basePrice: new Prisma.Decimal(rawInput.basePrice),
        compareAtPrice: toDecimalOrNull(rawInput.compareAtPrice),
        costPrice: toDecimalOrNull(rawInput.costPrice),
        metalType: rawInput.metalType ?? null,
        metalColor: rawInput.metalColor ?? null,
        metalPurity: rawInput.metalPurity ?? null,
        metalWeightGrams: toDecimalOrNull(rawInput.metalWeightGrams),
        stoneOrigin: rawInput.stoneOrigin ?? null,
        stoneShape: rawInput.stoneShape ?? null,
        caratTotal: toDecimalOrNull(rawInput.caratTotal),
        caratCenter: toDecimalOrNull(rawInput.caratCenter),
        colorGrade: rawInput.colorGrade ?? null,
        clarityGrade: rawInput.clarityGrade ?? null,
        cutGrade: rawInput.cutGrade ?? null,
        polishGrade: rawInput.polishGrade ?? null,
        symmetryGrade: rawInput.symmetryGrade ?? null,
        fluorescence: rawInput.fluorescence ?? null,
        certificationLab: rawInput.certificationLab ?? null,
        certificateNumber: rawInput.certificateNumber ?? null,
        certificateUrl: rawInput.certificateUrl ?? null,
        isFeatured: rawInput.isFeatured ?? false,
        isNewArrival: rawInput.isNewArrival ?? false,
        isBestseller: rawInput.isBestseller ?? false,
        hasSizing: rawInput.hasSizing ?? false,
        leadTimeDays: typeof rawInput.leadTimeDays === "number" ? rawInput.leadTimeDays : null,
        seoTitle: rawInput.seoTitle ?? null,
        seoDescription: rawInput.seoDescription ?? null,
        ogImageUrl: rawInput.ogImageUrl ?? null,
        canonicalOverride: rawInput.canonicalOverride ?? null,
        noindex: rawInput.noindex ?? false,
        gtin: rawInput.gtin ?? null,
        mpn: rawInput.mpn ?? null,
        googleProductCategory: rawInput.googleProductCategory ?? null,
      };

      const seenFacetKeys = new Set<string>();
      const facetValuesPayload = (rawInput.facetValues ?? [])
        .map((fv) => ({
          facetId: fv.facetId,
          optionId: fv.optionId ?? null,
          valueText: fv.valueText ?? null,
          valueNumber: toDecimalOrNull(fv.valueNumber),
          valueBoolean: fv.valueBoolean ?? null,
        }))
        .filter((fv) => {
          const hasValue =
            fv.optionId !== null ||
            fv.valueText !== null ||
            fv.valueNumber !== null ||
            fv.valueBoolean !== null;
          if (!hasValue) return false;
          const key = `${fv.facetId}::${fv.optionId ?? ""}`;
          if (seenFacetKeys.has(key)) return false;
          seenFacetKeys.add(key);
          return true;
        });

      if (rawInput.id) {
        const existing = await tx.product.findFirst({
          where: { id: rawInput.id, deletedAt: null },
          include: {
            variants: {
              include: { _count: { select: { orderItems: true } } },
            },
          },
        });
        if (!existing) throw new NotFoundError("Product not found.");

        if (existing.slug !== slug) {
          await tx.slugRedirect.upsert({
            where: { entityType_oldSlug: { entityType: "product", oldSlug: existing.slug } },
            update: { newSlug: slug },
            create: { entityType: "product", oldSlug: existing.slug, newSlug: slug },
          });
        }

        const updated = await tx.product.update({
          where: { id: existing.id },
          data: scalarData,
        });

        await tx.productImage.deleteMany({ where: { productId: updated.id } });
        if (normalizedImages.length > 0) {
          await tx.productImage.createMany({
            data: normalizedImages.map((img) => ({
              productId: updated.id,
              storageKey: img.storageKey,
              url: img.url,
              thumbUrl: img.thumbUrl ?? null,
              mediumUrl: img.mediumUrl ?? null,
              altText: img.altText,
              width: img.width ?? 1200,
              height: img.height ?? 1200,
              focalX: img.focalX ?? null,
              focalY: img.focalY ?? null,
              isPrimary: img.isPrimary,
              sortOrder: img.sortOrder,
            })),
          });
        }

        await tx.productFacetValue.deleteMany({ where: { productId: updated.id } });
        if (facetValuesPayload.length > 0) {
          await tx.productFacetValue.createMany({
            data: facetValuesPayload.map((fv) => ({ productId: updated.id, ...fv })),
          });
        }

        const existingMap = new Map(existing.variants.map((v) => [v.id, v]));
        const incomingIds = new Set(
          normalizedVariants
            .map((v) => v.id)
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        );

        for (const existingVariant of existing.variants) {
          if (!incomingIds.has(existingVariant.id)) {
            if (existingVariant._count.orderItems > 0) {
              throw new ConflictError(
                `Variant "${existingVariant.sku}" has historical order line items and cannot be deleted. Mark it inactive instead.`,
              );
            }
            if (existingVariant.reservedQty > 0) {
              throw new ConflictError(
                `Variant "${existingVariant.sku}" currently has reserved stock (${existingVariant.reservedQty}) for active checkouts and cannot be removed.`,
              );
            }
            await tx.productVariant.delete({ where: { id: existingVariant.id } });
          }
        }

        for (const variant of normalizedVariants) {
          if (variant.id && existingMap.has(variant.id)) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku,
                title: variant.title,
                size: variant.size ?? null,
                metal: variant.metal ?? null,
                stoneSpec: variant.stoneSpec ?? null,
                priceOverride: toDecimalOrNull(variant.priceOverride),
                compareAtOverride: toDecimalOrNull(variant.compareAtOverride),
                lowStockThreshold: variant.lowStockThreshold ?? 2,
                isDefault: variant.isDefault,
                isActive: variant.isActive ?? true,
                sortOrder: variant.sortOrder,
                weightGrams: toDecimalOrNull(variant.weightGrams),
              },
            });
          } else {
            const initQty = Number(variant.initialStockQty ?? 0);
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: updated.id,
                sku: variant.sku,
                title: variant.title,
                size: variant.size ?? null,
                metal: variant.metal ?? null,
                stoneSpec: variant.stoneSpec ?? null,
                priceOverride: toDecimalOrNull(variant.priceOverride),
                compareAtOverride: toDecimalOrNull(variant.compareAtOverride),
                stockQty: initQty,
                reservedQty: 0,
                lowStockThreshold: variant.lowStockThreshold ?? 2,
                isDefault: variant.isDefault,
                isActive: variant.isActive ?? true,
                sortOrder: variant.sortOrder,
                weightGrams: toDecimalOrNull(variant.weightGrams),
              },
            });

            if (initQty > 0) {
              await tx.inventoryTransaction.create({
                data: {
                  variantId: createdVariant.id,
                  reason: "INITIAL",
                  delta: initQty,
                  balanceAfter: initQty,
                  referenceType: "PRODUCT_UPDATE",
                  referenceId: updated.id,
                  note: "Initial stock on new variant creation",
                  actorId,
                },
              });
            }
          }
        }

        return { id: updated.id, slug: updated.slug, oldSlug: existing.slug };
      }

      const created = await tx.product.create({
        data: {
          ...scalarData,
          images: {
            create: normalizedImages.map((img) => ({
              storageKey: img.storageKey,
              url: img.url,
              thumbUrl: img.thumbUrl ?? null,
              mediumUrl: img.mediumUrl ?? null,
              altText: img.altText,
              width: img.width ?? 1200,
              height: img.height ?? 1200,
              focalX: img.focalX ?? null,
              focalY: img.focalY ?? null,
              isPrimary: img.isPrimary,
              sortOrder: img.sortOrder,
            })),
          },
          facetValues: {
            create: facetValuesPayload,
          },
        },
      });

      for (const variant of normalizedVariants) {
        const initQty = Number(variant.initialStockQty ?? 0);
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: variant.sku,
            title: variant.title,
            size: variant.size ?? null,
            metal: variant.metal ?? null,
            stoneSpec: variant.stoneSpec ?? null,
            priceOverride: toDecimalOrNull(variant.priceOverride),
            compareAtOverride: toDecimalOrNull(variant.compareAtOverride),
            stockQty: initQty,
            reservedQty: 0,
            lowStockThreshold: variant.lowStockThreshold ?? 2,
            isDefault: variant.isDefault,
            isActive: variant.isActive ?? true,
            sortOrder: variant.sortOrder,
            weightGrams: toDecimalOrNull(variant.weightGrams),
          },
        });

        if (initQty > 0) {
          await tx.inventoryTransaction.create({
            data: {
              variantId: createdVariant.id,
              reason: "INITIAL",
              delta: initQty,
              balanceAfter: initQty,
              referenceType: "PRODUCT_CREATE",
              referenceId: created.id,
              note: "Initial stock on product creation",
              actorId,
            },
          });
        }
      }

      return { id: created.id, slug: created.slug, oldSlug: null as string | null };
    });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw new ConflictError(
        "A product or variant already uses that SKU or URL slug. Please use unique identifiers.",
      );
    }
    throw error;
  }
}

export async function softDeleteProduct(id: string) {
  const existing = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Product not found.");

  await db.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "ARCHIVED",
    },
  });

  return { id, slug: existing.slug };
}

export async function listAdminInventory(params: {
  search?: string;
  onlyLowStock?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, params.pageSize ?? 25));
  const search = params.search?.trim();

  const where: Prisma.ProductVariantWhereInput = {
    product: { deletedAt: null },
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await db.productVariant.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, slug: true, status: true } },
    },
    orderBy: [{ stockQty: "asc" }, { product: { name: "asc" } }, { sortOrder: "asc" }],
  });

  const mapped: AdminInventoryRowDTO[] = rows
    .map((v) => {
      const availableQty = v.stockQty - v.reservedQty;
      return {
        id: v.id,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        productStatus: v.product.status,
        sku: v.sku,
        title: v.title,
        stockQty: v.stockQty,
        reservedQty: v.reservedQty,
        availableQty,
        lowStockThreshold: v.lowStockThreshold,
        isLowStock: availableQty <= v.lowStockThreshold,
        isActive: v.isActive,
      };
    })
    .filter((row) => (params.onlyLowStock ? row.isLowStock : true));

  const total = mapped.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: mapped.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listInventoryTransactions(params: {
  variantId?: string;
  limit?: number;
}): Promise<InventoryTransactionDTO[]> {
  const rows = await db.inventoryTransaction.findMany({
    where: params.variantId ? { variantId: params.variantId } : undefined,
    include: {
      variant: {
        select: {
          sku: true,
          title: true,
          product: { select: { name: true } },
        },
      },
      actor: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, params.limit ?? 30)),
  });

  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    variantSku: r.variant.sku,
    variantTitle: r.variant.title,
    productName: r.variant.product.name,
    reason: r.reason,
    delta: r.delta,
    balanceAfter: r.balanceAfter,
    referenceType: r.referenceType,
    referenceId: r.referenceId,
    note: r.note,
    actorEmail: r.actor?.email ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adjustVariantStock(rawInput: AdjustStockInput, actorId: string | null) {
  const delta = Number(rawInput.delta);

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; stockQty: number; reservedQty: number; productId: string }>
    >`
      SELECT id, "stockQty", "reservedQty", "productId"
      FROM "ProductVariant"
      WHERE id = ${rawInput.variantId}
      FOR UPDATE
    `;

    const row = locked[0];
    if (!row) {
      throw new NotFoundError("Product variant not found.");
    }

    const nextStock = row.stockQty + delta;
    if (nextStock < 0) {
      throw new ValidationError("Stock adjustment cannot bring on-hand quantity below zero.", {
        delta: [`Current stock is ${row.stockQty}. Cannot subtract ${Math.abs(delta)}.`],
      });
    }
    if (nextStock < row.reservedQty) {
      throw new ConflictError(
        `Cannot reduce stock on hand (${nextStock}) below reserved quantity (${row.reservedQty}) held by active checkouts.`,
      );
    }

    await tx.productVariant.update({
      where: { id: row.id },
      data: { stockQty: nextStock },
    });

    const ledger = await tx.inventoryTransaction.create({
      data: {
        variantId: row.id,
        reason: rawInput.reason,
        delta,
        balanceAfter: nextStock,
        referenceType: "ADMIN_MANUAL",
        note: rawInput.note.trim(),
        actorId,
      },
    });

    return {
      id: ledger.id,
      variantId: row.id,
      productId: row.productId,
      previousStock: row.stockQty,
      stockQty: nextStock,
      reservedQty: row.reservedQty,
      availableQty: nextStock - row.reservedQty,
    };
  });
}
