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
    isPublished: z.boolean().default(false),
    seoTitle: z.string().trim().max(120).optional().nullable(),
    seoDescription: z.string().trim().max(320).optional().nullable(),
    relatedCategorySlug: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

export const deleteArticleSchema = z.object({ id: z.string().min(1) }).strict();
