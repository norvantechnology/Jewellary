import { z } from "zod";

export const articleUpsertSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(3, "Article title is required.").max(180),
    slug: z
      .string()
      .trim()
      .max(180)
      .regex(/^[a-z0-9-]*$/, "Slug may only contain lowercase letters, numbers, and hyphens.")
      .optional(),
    excerpt: z.string().trim().min(10, "Excerpt must be at least 10 characters.").max(400),
    bodyMarkdown: z.string().trim().min(20, "Article content is required."),
    coverImageUrl: z.string().trim().optional().nullable(),
    coverAltText: z.string().trim().max(250).optional().nullable(),
    authorName: z.string().trim().min(2, "Author name is required.").max(120),
    authorJobTitle: z.string().trim().max(120).optional().nullable(),
    authorCredentials: z.string().trim().max(240).optional().nullable(),
    authorBio: z.string().trim().max(600).optional().nullable(),
    authorSameAs: z.array(z.string().trim().url()).max(6).optional().default([]),
    articleSection: z.string().trim().max(120).optional().nullable(),
    isPublished: z.boolean().default(false),
    seoTitle: z.string().trim().max(120).optional().nullable(),
    seoDescription: z.string().trim().max(320).optional().nullable(),
    seoKeywords: z.string().trim().max(300).optional().nullable(),
    seoFaqs: z
      .array(
        z
          .object({
            question: z.string().trim().min(5).max(280),
            answer: z.string().trim().min(5).max(1200),
          })
          .strict(),
      )
      .max(15)
      .optional()
      .default([]),
    ogTitle: z.string().trim().max(140).optional().nullable(),
    ogDescription: z.string().trim().max(320).optional().nullable(),
    ogImageUrl: z.string().trim().max(500).optional().nullable(),
    canonicalOverride: z.string().trim().max(500).optional().nullable(),
    noindex: z.boolean().default(false),
    relatedCategorySlug: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

export const deleteArticleSchema = z.object({ id: z.string().min(1) }).strict();
