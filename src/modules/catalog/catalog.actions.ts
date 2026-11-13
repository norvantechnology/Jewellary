"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { submitIndexNowUrls } from "@/lib/seo/indexnow";
import {
  adjustStockSchema,
  archiveProductSchema,
  categoryUpsertSchema,
  deleteCategorySchema,
  deleteFacetSchema,
  deleteProductSchema,
  duplicateProductSchema,
  facetUpsertSchema,
  productUpsertSchema,
} from "@/modules/catalog/catalog.schemas";
import {
  adjustVariantStock,
  archiveProduct,
  deleteCategory,
  deleteFacet,
  deleteProduct,
  duplicateProduct,
  upsertCategory,
  upsertFacet,
  upsertProduct,
} from "@/modules/catalog/catalog.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";

function invalidateCatalogTags(tags: string[], paths: string[] = []) {
  for (const tag of tags) {
    updateTag(tag);
    revalidateTag(tag, "max");
  }
  for (const p of paths) {
    revalidatePath(p);
  }
}

export const upsertCategoryAction = createAction(
  {
    name: "catalog.category.upsert",
    schema: categoryUpsertSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "CATEGORY_UPSERT",
      entityType: "Category",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    const result = await upsertCategory(input);
    invalidateCatalogTags(
      [CACHE_TAGS.categories, CACHE_TAGS.category(result.id)],
      ["/", "/collections", `/collections/${result.path}`, "/sitemap.xml"],
    );
    void submitIndexNowUrls([`/collections/${result.path}`]);
    return result;
  },
);

export const deleteCategoryAction = createAction(
  {
    name: "catalog.category.delete",
    schema: deleteCategorySchema,
    auth: { permission: "catalog:delete" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "CATEGORY_DELETE",
      entityType: "Category",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const result = await deleteCategory(id);
    invalidateCatalogTags([CACHE_TAGS.categories, CACHE_TAGS.category(id)]);
    return result;
  },
);

export const upsertFacetAction = createAction(
  {
    name: "catalog.facet.upsert",
    schema: facetUpsertSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "FACET_UPSERT",
      entityType: "Facet",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    const result = await upsertFacet(input);
    invalidateCatalogTags([CACHE_TAGS.facets, CACHE_TAGS.categories]);
    return result;
  },
);

export const deleteFacetAction = createAction(
  {
    name: "catalog.facet.delete",
    schema: deleteFacetSchema,
    auth: { permission: "catalog:delete" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "FACET_DELETE",
      entityType: "Facet",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const result = await deleteFacet(id);
    invalidateCatalogTags([CACHE_TAGS.facets, CACHE_TAGS.categories]);
    return result;
  },
);

export const upsertProductAction = createAction(
  {
    name: "catalog.product.upsert",
    schema: productUpsertSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "PRODUCT_UPSERT",
      entityType: "Product",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input, ctx) => {
    const result = await upsertProduct(input, ctx.auth?.user.id ?? null);
    const tags = [
      CACHE_TAGS.products,
      CACHE_TAGS.product(result.id),
      CACHE_TAGS.productSlug(result.slug),
    ];
    if (result.oldSlug && result.oldSlug !== result.slug) {
      tags.push(CACHE_TAGS.productSlug(result.oldSlug));
    }
    invalidateCatalogTags(tags, [
      "/",
      "/collections",
      `/products/${result.slug}`,
      "/sitemap.xml",
      "/feeds/google-merchant.xml",
    ]);
    if (input.status === "ACTIVE" && !input.noindex) {
      void submitIndexNowUrls([`/products/${result.slug}`]);
    }
    return result;
  },
);

export const archiveProductAction = createAction(
  {
    name: "catalog.product.archive",
    schema: archiveProductSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "PRODUCT_ARCHIVE",
      entityType: "Product",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const result = await archiveProduct(id);
    invalidateCatalogTags([
      CACHE_TAGS.products,
      CACHE_TAGS.product(id),
      CACHE_TAGS.productSlug(result.slug),
    ]);
    return result;
  },
);

export const deleteProductAction = createAction(
  {
    name: "catalog.product.delete",
    schema: deleteProductSchema,
    auth: { permission: "catalog:delete" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "PRODUCT_DELETE",
      entityType: "Product",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const result = await deleteProduct(id);
    invalidateCatalogTags([
      CACHE_TAGS.products,
      CACHE_TAGS.product(id),
      CACHE_TAGS.productSlug(result.slug),
    ]);
    return result;
  },
);

export const duplicateProductAction = createAction(
  {
    name: "catalog.product.duplicate",
    schema: duplicateProductSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "PRODUCT_DUPLICATE",
      entityType: "Product",
      entityId: (_input, res: { id: string }) => res.id,
      after: (input, res: { id: string; slug: string; sku: string }) => ({
        sourceProductId: input.id,
        duplicatedProductId: res.id,
        duplicatedSlug: res.slug,
        duplicatedSku: res.sku,
      }),
    },
  },
  async ({ id }, ctx) => {
    const result = await duplicateProduct(id, ctx.auth?.user.id ?? null);
    invalidateCatalogTags([CACHE_TAGS.products]);
    return result;
  },
);

export const adjustStockAction = createAction(
  {
    name: "catalog.inventory.adjust",
    schema: adjustStockSchema,
    auth: { permission: "inventory:adjust" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "INVENTORY_ADJUST",
      entityType: "ProductVariant",
      entityId: (input) => input.variantId,
      after: (input, res: Awaited<ReturnType<typeof adjustVariantStock>>) => ({
        input,
        result: res,
      }),
    },
  },
  async (input, ctx) => {
    const result = await adjustVariantStock(input, ctx.auth?.user.id ?? null);
    invalidateCatalogTags([CACHE_TAGS.products, CACHE_TAGS.product(result.productId)]);
    return result;
  },
);
