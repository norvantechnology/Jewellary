import { z } from "zod";

const moneyStringRegex = /^\d{1,9}(\.\d{1,2})?$/;
const caratStringRegex = /^\d{1,4}(\.\d{1,4})?$/;
const hexSwatchRegex = /^#[0-9a-fA-F]{6}$/;

const optionalMoneyString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  })
  .refine((v) => v === null || moneyStringRegex.test(v), {
    message: "Enter a valid non-negative monetary amount (up to 2 decimal places).",
  });

const requiredMoneyString = z
  .string()
  .trim()
  .min(1, "Price is required.")
  .refine((v) => moneyStringRegex.test(v), {
    message: "Enter a valid non-negative price (e.g. 2450.00).",
  });

const optionalCaratOrWeightString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  })
  .refine((v) => v === null || caratStringRegex.test(v), {
    message: "Enter a valid non-negative numeric measurement.",
  });

const optionalCleanText = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .nullable()
    .optional()
    .transform((v) => (v === null || v === undefined || v === "" ? null : v));

const seoFaqPairSchema = z
  .object({
    question: z.string().trim().min(3).max(280),
    answer: z.string().trim().min(3).max(1200),
  })
  .strict();

export const categoryUpsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Category name is required.").max(100),
    slug: optionalCleanText(120),
    parentId: optionalCleanText(64),
    description: optionalCleanText(2000),
    imageUrl: optionalCleanText(500),
    seoTitle: optionalCleanText(120),
    seoDescription: optionalCleanText(320),
    seoKeywords: optionalCleanText(300),
    seoIntroCopy: optionalCleanText(4000),
    seoIntroPosition: z.enum(["top", "bottom"]).optional().default("top"),
    seoFaqs: z.array(seoFaqPairSchema).max(15).optional().default([]),
    ogTitle: optionalCleanText(140),
    ogDescription: optionalCleanText(320),
    ogImageUrl: optionalCleanText(500),
    canonicalOverride: optionalCleanText(500),
    noindex: z.boolean().optional().default(false),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    isActive: z.boolean().default(true),
    facetIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const deleteCategorySchema = z
  .object({
    id: z.string().min(1, "Category ID is required."),
  })
  .strict();

export const facetOptionInputSchema = z
  .object({
    id: z.string().optional(),
    value: z.string().trim().min(1, "Option value is required.").max(80),
    label: z.string().trim().min(1, "Option label is required.").max(100),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    swatchHex: optionalCleanText(16).refine((v) => v === null || hexSwatchRegex.test(v), {
      message: "Swatch color must be a 6-digit color code.",
    }),
  })
  .strict();

export const facetUpsertSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(2, "Facet code is required.")
      .max(60)
      .regex(/^[a-z0-9_]+$/, "Code must contain only lowercase letters, numbers, and underscores."),
    name: z.string().trim().min(2, "Facet name is required.").max(80),
    valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "RANGE"]).default("TEXT"),
    isFilterable: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    unit: optionalCleanText(24),
    options: z.array(facetOptionInputSchema).default([]),
  })
  .strict();

export const deleteFacetSchema = z
  .object({
    id: z.string().min(1, "Facet ID is required."),
  })
  .strict();

export const productVariantInputSchema = z
  .object({
    id: z.string().optional(),
    sku: z.string().trim().min(2, "Variant SKU is required.").max(64),
    title: z.string().trim().min(1, "Variant title is required.").max(120),
    size: optionalCleanText(40),
    metal: optionalCleanText(60),
    stoneSpec: optionalCleanText(120),
    priceOverride: optionalMoneyString,
    compareAtOverride: optionalMoneyString,
    initialStockQty: z.coerce.number().int().min(0).max(100000).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).max(10000).default(2),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    weightGrams: optionalCaratOrWeightString,
  })
  .strict();

export const productImageInputSchema = z
  .object({
    id: z.string().optional(),
    storageKey: z.string().trim().min(1, "Image storage key is required."),
    url: z.string().trim().min(1, "Image URL is required."),
    thumbUrl: optionalCleanText(500),
    mediumUrl: optionalCleanText(500),
    avifUrl: optionalCleanText(500),
    jpegUrl: optionalCleanText(500),
    responsiveVariants: z.record(z.string(), z.unknown()).optional().nullable(),
    altText: z
      .string()
      .trim()
      .min(3, "Accessible alt text (min 3 characters) is required for every image.")
      .max(240),
    viewType: z
      .enum(["front", "side", "detail", "on-hand", "lifestyle", "packaging", "certificate"])
      .optional()
      .default("front"),
    title: optionalCleanText(160),
    caption: optionalCleanText(300),
    creditText: optionalCleanText(160),
    copyrightNotice: optionalCleanText(200),
    licenseUrl: optionalCleanText(500),
    width: z.coerce.number().int().min(1).max(20000).default(1200),
    height: z.coerce.number().int().min(1).max(20000).default(1200),
    focalX: z.number().min(0).max(1).optional().nullable(),
    focalY: z.number().min(0).max(1).optional().nullable(),
    isPrimary: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

export const productFacetValueInputSchema = z
  .object({
    facetId: z.string().min(1),
    optionId: optionalCleanText(64),
    valueText: optionalCleanText(160),
    valueNumber: optionalCaratOrWeightString,
    valueBoolean: z.boolean().optional().nullable(),
  })
  .strict();

export const productUpsertSchema = z
  .object({
    id: z.string().optional(),
    sku: z.string().trim().min(2, "Product SKU is required.").max(64),
    name: z.string().trim().min(2, "Product title is required.").max(160),
    slug: optionalCleanText(160),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    categoryId: z.string().trim().min(1, "Select a category."),
    subtitle: optionalCleanText(200),
    description: optionalCleanText(8000),
    isFeatured: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    isBestseller: z.boolean().default(false),
    hasSizing: z.boolean().default(false),
    leadTimeDays: z
      .union([z.coerce.number().int().min(0).max(365), z.null(), z.undefined(), z.literal("")])
      .transform((v) => (v === "" || v === undefined ? null : v)),

    priceMode: z.enum(["FIXED", "PRICE_ON_REQUEST"]).default("FIXED"),
    basePrice: requiredMoneyString,
    compareAtPrice: optionalMoneyString,
    costPrice: optionalMoneyString,

    metalType: optionalCleanText(60),
    metalColor: optionalCleanText(60),
    metalPurity: optionalCleanText(40),
    metalWeightGrams: optionalCaratOrWeightString,
    stoneOrigin: optionalCleanText(40),
    stoneShape: optionalCleanText(40),
    caratTotal: optionalCaratOrWeightString,
    caratCenter: optionalCaratOrWeightString,
    colorGrade: optionalCleanText(30),
    clarityGrade: optionalCleanText(30),
    cutGrade: optionalCleanText(30),
    polishGrade: optionalCleanText(30),
    symmetryGrade: optionalCleanText(30),
    fluorescence: optionalCleanText(40),
    certificationLab: optionalCleanText(40),
    certificateNumber: optionalCleanText(80),
    certificateUrl: optionalCleanText(500),

    variants: z
      .array(productVariantInputSchema)
      .min(1, "Add at least one variant (or default piece) before saving."),
    images: z.array(productImageInputSchema).default([]),
    facetValues: z.array(productFacetValueInputSchema).default([]),

    seoTitle: optionalCleanText(120),
    seoDescription: optionalCleanText(320),
    seoKeywords: optionalCleanText(300),
    seoFaqs: z.array(seoFaqPairSchema).max(15).optional().default([]),
    ogTitle: optionalCleanText(140),
    ogDescription: optionalCleanText(320),
    ogImageUrl: optionalCleanText(500),
    canonicalOverride: optionalCleanText(500),
    noindex: z.boolean().default(false),
    warrantyText: optionalCleanText(300),
    salePriceStartAt: optionalCleanText(40),
    salePriceEndAt: optionalCleanText(40),
    gtin: optionalCleanText(32),
    mpn: optionalCleanText(64),
    googleProductCategory: optionalCleanText(180),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === "ACTIVE" && data.images.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Active products require at least one uploaded image with alt text.",
      });
    }
    const skus = new Set<string>();
    data.variants.forEach((variant, index) => {
      const normalized = variant.sku.toUpperCase();
      if (skus.has(normalized)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "sku"],
          message: `Duplicate variant SKU "${variant.sku}" within the same product.`,
        });
      }
      skus.add(normalized);
    });
  });

export const deleteProductSchema = z
  .object({
    id: z.string().min(1, "Product ID is required."),
  })
  .strict();

export const archiveProductSchema = deleteProductSchema;
export const duplicateProductSchema = deleteProductSchema;

export const adjustStockSchema = z
  .object({
    variantId: z.string().min(1, "Variant is required."),
    reason: z.enum(["RESTOCK", "ADJUSTMENT", "RETURN", "RELEASE"]),
    delta: z.coerce
      .number()
      .int()
      .min(-10000)
      .max(10000)
      .refine((n) => n !== 0, "Quantity adjustment delta cannot be zero."),
    note: z.string().trim().min(2, "Provide an inventory audit note.").max(250),
  })
  .strict();

export type CategoryUpsertInput = z.input<typeof categoryUpsertSchema>;
export type FacetUpsertInput = z.infer<typeof facetUpsertSchema>;
export type ProductUpsertInput = z.input<typeof productUpsertSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const bulkPriceSchema = z
  .object({
    productIds: z.array(z.string().min(1).max(64)).max(5000).optional(),
    filter: z
      .object({
        search: z.string().trim().max(200).optional(),
        status: z.enum(["ALL", "ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
        categoryId: z.string().trim().max(64).optional(),
      })
      .strict()
      .optional(),
    percent: z.number().gt(-90).max(500),
    rounding: z.enum(["cents", "whole", "ninety-nine"]),
    includeCompareAt: z.boolean(),
  })
  .strict()
  .refine((v) => (v.productIds?.length ?? 0) > 0 || v.filter, {
    message: "Select at least one product.",
  });
