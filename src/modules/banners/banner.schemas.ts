import { z } from "zod";

export const bannerUpsertSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Title is required.").max(140),
    subtitle: z.string().trim().max(300).optional().nullable(),
    ctaLabel: z.string().trim().max(60).optional().nullable(),
    ctaHref: z.string().trim().max(240).optional().nullable(),
    imageUrl: z.string().trim().min(1, "Desktop image URL is required."),
    mobileImageUrl: z.string().trim().optional().nullable(),
    altText: z.string().trim().min(5, "Accessible image alt text is required.").max(250),
    position: z.enum(["HERO", "STRIP", "EDITORIAL"]).default("HERO"),
    isActive: z.boolean().default(true),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const deleteBannerSchema = z.object({ id: z.string().min(1) }).strict();
