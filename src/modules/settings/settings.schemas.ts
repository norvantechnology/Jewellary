import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid non-negative decimal amount.");

export const socialLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    href: z.string().trim().url("Enter a valid URL starting with https://"),
  })
  .strict();

export const physicalStoreSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(""),
    streetAddress: z.string().trim().max(180).optional().default(""),
    city: z.string().trim().max(100).optional().default(""),
    state: z.string().trim().max(100).optional().default(""),
    postalCode: z.string().trim().max(30).optional().default(""),
    country: z.string().trim().max(2).optional().default(""),
    hours: z.string().trim().max(120).optional().default(""),
  })
  .strict();

export const updateStoreSettingsSchema = z
  .object({
    storeName: z.string().trim().min(2, "Store name is required.").max(100),
    tagline: z.string().trim().max(200).optional().nullable(),
    contactEmail: z.string().trim().email("Enter a valid contact email."),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    supportHours: z.string().trim().max(120).optional().nullable(),
    currency: z.string().trim().length(3).toUpperCase().default("USD"),
    defaultCountry: z.string().trim().length(2).toUpperCase().default("US"),
    supportedCountries: z.array(z.string().trim().length(2).toUpperCase()).min(1),
    taxRatePercent: z.coerce
      .number()
      .min(0, "Tax rate cannot be negative.")
      .max(50, "Tax rate cannot exceed 50%."),
    taxLabel: z.string().trim().min(1).max(60),
    taxInclusive: z.boolean(),
    freeShippingThreshold: moneyString.optional().nullable().or(z.literal("")),
    signatureThreshold: moneyString,
    returnWindowDays: z.coerce.number().int().min(0).max(365),
    announcementBarEnabled: z.boolean(),
    announcementBarText: z.string().trim().max(200).optional().nullable(),
    announcementBarHref: z.string().trim().max(200).optional().nullable(),
    logoUrl: z.string().trim().max(300).optional().nullable(),
    allowAiCrawlers: z.boolean(),
    seoDefaultTitlePattern: z.string().trim().max(160).optional().nullable(),
    seoDefaultDescription: z.string().trim().max(320).optional().nullable(),
    defaultOgImageUrl: z.string().trim().max(300).optional().nullable(),
    socialLinks: z.array(socialLinkSchema).max(8).optional(),
    physicalStore: physicalStoreSchema.optional().nullable(),
  })
  .strict();

export const shippingZoneSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Zone name is required.").max(100),
    countries: z
      .array(z.string().trim().length(2).toUpperCase())
      .min(1, "Add at least one country code."),
    flatRate: moneyString,
    freeThreshold: moneyString.optional().nullable().or(z.literal("")),
    estimatedDaysMin: z.coerce.number().int().min(1).max(60),
    estimatedDaysMax: z.coerce.number().int().min(1).max(90),
    isInsured: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .strict()
  .refine((v) => v.estimatedDaysMax >= v.estimatedDaysMin, {
    message: "Max delivery days must be >= min delivery days.",
    path: ["estimatedDaysMax"],
  });

export const deleteShippingZoneSchema = z.object({ id: z.string().min(1) }).strict();
