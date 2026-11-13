import { z } from "zod";

export const seoFaqItemSchema = z
  .object({
    question: z.string().trim().min(5, "Question must be at least 5 characters.").max(280),
    answer: z.string().trim().min(5, "Answer must be at least 5 characters.").max(1200),
  })
  .strict();

export const redirectRuleUpsertSchema = z
  .object({
    id: z.string().optional(),
    fromPath: z
      .string()
      .trim()
      .min(1, "Source path is required.")
      .max(500)
      .refine((v) => v.startsWith("/"), "Source path must start with /."),
    toPath: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : v)),
    statusCode: z.coerce
      .number()
      .int()
      .refine((code) => [301, 302, 307, 308, 410].includes(code), {
        message: "Status code must be 301, 302, 307, 308, or 410.",
      })
      .default(301),
    note: z.string().trim().max(300).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.statusCode !== 410 && !data.toPath) {
      ctx.addIssue({
        code: "custom",
        path: ["toPath"],
        message: "Destination path is required unless status code is 410 (Gone).",
      });
    }
  });

export const deleteByIdSchema = z.object({ id: z.string().min(1) }).strict();

export const redirectCsvImportSchema = z
  .object({
    csvText: z.string().trim().min(3, "Paste CSV lines to import.").max(500_000),
  })
  .strict();

export const landingFacetFilterParamsSchema = z
  .object({
    metal: z.array(z.string().trim()).optional(),
    shape: z.array(z.string().trim()).optional(),
    origin: z.array(z.string().trim()).optional(),
    certification: z.array(z.string().trim()).optional(),
    color: z.array(z.string().trim()).optional(),
    clarity: z.array(z.string().trim()).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    featured: z.boolean().optional(),
  })
  .strict();

export const landingFacetUpsertSchema = z
  .object({
    id: z.string().optional(),
    categoryPath: z
      .string()
      .trim()
      .min(1, "Category path is required.")
      .max(180)
      .regex(/^[a-z0-9-/]+$/, "Lowercase slug path only."),
    facetSlug: z
      .string()
      .trim()
      .min(2, "Facet URL slug is required.")
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Facet slug must use lowercase letters, numbers, and hyphens."),
    name: z.string().trim().min(2).max(120),
    h1: z.string().trim().min(2).max(160),
    introCopy: z.string().trim().max(4000).optional().nullable(),
    seoTitle: z.string().trim().max(120).optional().nullable(),
    seoDescription: z.string().trim().max(320).optional().nullable(),
    seoKeywords: z.string().trim().max(300).optional().nullable(),
    seoFaqs: z.array(seoFaqItemSchema).max(12).optional().default([]),
    ogTitle: z.string().trim().max(140).optional().nullable(),
    ogDescription: z.string().trim().max(320).optional().nullable(),
    ogImageUrl: z.string().trim().max(500).optional().nullable(),
    canonicalOverride: z.string().trim().max(500).optional().nullable(),
    filterParams: landingFacetFilterParamsSchema,
    isActive: z.boolean().default(true),
    noindex: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

export const staticPageSeoUpsertSchema = z
  .object({
    slug: z.string().trim().min(1).max(120),
    label: z.string().trim().min(2).max(120),
    seoTitle: z.string().trim().max(120).optional().nullable(),
    seoDescription: z.string().trim().max(320).optional().nullable(),
    seoKeywords: z.string().trim().max(300).optional().nullable(),
    ogTitle: z.string().trim().max(140).optional().nullable(),
    ogDescription: z.string().trim().max(320).optional().nullable(),
    ogImageUrl: z.string().trim().max(500).optional().nullable(),
    canonicalOverride: z.string().trim().max(500).optional().nullable(),
    noindex: z.boolean().default(false),
    seoFaqs: z.array(seoFaqItemSchema).max(20).optional().default([]),
  })
  .strict();

export const seoTemplatesUpdateSchema = z
  .object({
    homeTitle: z.string().trim().min(5).max(160),
    homeDescription: z.string().trim().min(10).max(320),
    productTitle: z.string().trim().min(5).max(160),
    productDescription: z.string().trim().min(10).max(320),
    collectionTitle: z.string().trim().min(5).max(160),
    collectionDescription: z.string().trim().min(10).max(320),
    facetTitle: z.string().trim().min(5).max(160),
    facetDescription: z.string().trim().min(10).max(320),
    guideTitle: z.string().trim().min(5).max(160),
    guideDescription: z.string().trim().min(10).max(320),
    pageTitle: z.string().trim().min(5).max(160),
    pageDescription: z.string().trim().min(10).max(320),
  })
  .strict();

export const globalSeoConfigUpdateSchema = z
  .object({
    legalName: z.string().trim().max(160).optional().nullable(),
    seoDefaultTitlePattern: z.string().trim().max(160).optional().nullable(),
    seoDefaultDescription: z.string().trim().max(320).optional().nullable(),
    defaultOgImageUrl: z.string().trim().max(500).optional().nullable(),
    allowAiCrawlers: z.boolean(),
    canonicalHost: z.string().trim().max(180).optional().nullable(),
    trailingSlashPolicy: z.enum(["remove", "preserve"]).default("remove"),
    maintenanceMode: z.boolean().default(false),
    maintenanceRetryAfterSeconds: z.coerce.number().int().min(60).max(86400).default(3600),
    googleSiteVerification: z.string().trim().max(200).optional().nullable(),
    bingSiteVerification: z.string().trim().max(200).optional().nullable(),
    pinterestVerification: z.string().trim().max(200).optional().nullable(),
    indexNowKey: z.string().trim().max(128).optional().nullable(),
    indexNowEnabled: z.boolean().default(true),
    defaultTwitterHandle: z.string().trim().max(80).optional().nullable(),
    defaultGoogleProductCategory: z.string().trim().max(180).optional().nullable(),
    customRobotsDisallow: z.array(z.string().trim().max(120)).max(30).default([]),
    aiVisibilityChecklist: z.record(z.string(), z.boolean()).default({}),
  })
  .strict();

export const bulkSeoRowUpdateSchema = z
  .object({
    entityType: z.enum(["product", "category", "article"]),
    id: z.string().min(1),
    seoTitle: z.string().trim().max(120).nullable(),
    seoDescription: z.string().trim().max(320).nullable(),
    seoKeywords: z.string().trim().max(300).nullable(),
    canonicalOverride: z.string().trim().max(500).nullable(),
    noindex: z.boolean(),
  })
  .strict();

export const bulkSeoBatchSchema = z
  .object({
    updates: z.array(bulkSeoRowUpdateSchema).min(1).max(200),
  })
  .strict();

export const runSeoAuditSchema = z
  .object({
    checkImagesHttp: z.boolean().default(false),
  })
  .strict();
