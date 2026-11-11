import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import type { SiteHeaderConfig } from "@/types/navigation";

export interface PublicStoreSettings {
  storeName: string;
  tagline: string | null;
  contactEmail: string;
  contactPhone: string | null;
  supportHours: string | null;
  currency: string;
  defaultCountry: string;
  supportedCountries: string[];
  taxRate: string;
  taxLabel: string;
  taxInclusive: boolean;
  freeShippingThreshold: string | null;
  signatureThreshold: string;
  returnWindowDays: number;
  announcementBarEnabled: boolean;
  announcementBarText: string | null;
  announcementBarHref: string | null;
  logoUrl: string | null;
  socialLinks: Array<{ label: string; href: string }>;
  physicalStore: {
    name?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    hours?: string;
  } | null;
  allowAiCrawlers: boolean;
  seoDefaultTitlePattern: string | null;
  seoDefaultDescription: string | null;
  defaultOgImageUrl: string | null;
}

export interface ShippingZoneDTO {
  id: string;
  name: string;
  countries: string[];
  flatRate: string;
  freeThreshold: string | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isInsured: boolean;
  isActive: boolean;
  sortOrder: number;
}

export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);

  const row = await db.storeSetting.findUnique({ where: { id: "default" } });
  if (!row) {
    return {
      storeName: env.NEXT_PUBLIC_SITE_NAME,
      tagline: null,
      contactEmail: env.EMAIL_FROM,
      contactPhone: null,
      supportHours: null,
      currency: "USD",
      defaultCountry: "US",
      supportedCountries: ["US", "CA", "GB", "AU", "IN"],
      taxRate: "0.0800",
      taxLabel: "Estimated Tax",
      taxInclusive: false,
      freeShippingThreshold: "1000.00",
      signatureThreshold: "500.00",
      returnWindowDays: 30,
      announcementBarEnabled: true,
      announcementBarText: "Complimentary insured express delivery on orders above $1,000",
      announcementBarHref: "/shipping-returns",
      logoUrl: null,
      socialLinks: [],
      physicalStore: null,
      allowAiCrawlers: true,
      seoDefaultTitlePattern: `%s | ${env.NEXT_PUBLIC_SITE_NAME}`,
      seoDefaultDescription: null,
      defaultOgImageUrl: null,
    };
  }

  return {
    storeName: row.storeName,
    tagline: row.tagline,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    supportHours: row.supportHours,
    currency: row.currency,
    defaultCountry: row.defaultCountry,
    supportedCountries: row.supportedCountries,
    taxRate: row.taxRate.toString(),
    taxLabel: row.taxLabel,
    taxInclusive: row.taxInclusive,
    freeShippingThreshold: row.freeShippingThreshold?.toString() ?? null,
    signatureThreshold: row.signatureThreshold.toString(),
    returnWindowDays: row.returnWindowDays,
    announcementBarEnabled: row.announcementBarEnabled,
    announcementBarText: row.announcementBarText,
    announcementBarHref: row.announcementBarHref,
    logoUrl: row.logoUrl,
    socialLinks: Array.isArray(row.socialLinks)
      ? (row.socialLinks as Array<{ label: string; href: string }>)
      : [],
    physicalStore:
      row.physicalStore && typeof row.physicalStore === "object"
        ? (row.physicalStore as PublicStoreSettings["physicalStore"])
        : null,
    allowAiCrawlers: row.allowAiCrawlers,
    seoDefaultTitlePattern: row.seoDefaultTitlePattern,
    seoDefaultDescription: row.seoDefaultDescription,
    defaultOgImageUrl: row.defaultOgImageUrl,
  };
}

export async function getAllShippingZones(onlyActive = false): Promise<ShippingZoneDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.shipping);

  const zones = await db.shippingZone.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    countries: z.countries,
    flatRate: z.flatRate.toString(),
    freeThreshold: z.freeThreshold?.toString() ?? null,
    estimatedDaysMin: z.estimatedDaysMin,
    estimatedDaysMax: z.estimatedDaysMax,
    isInsured: z.isInsured,
    isActive: z.isActive,
    sortOrder: z.sortOrder,
  }));
}

export async function getSiteHeaderConfig(): Promise<SiteHeaderConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings, CACHE_TAGS.categories);

  const [settings, rootCategories] = await Promise.all([
    getPublicStoreSettings(),
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        path: true,
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true, path: true },
        },
      },
    }),
  ]);

  return {
    siteName: settings.storeName,
    announcementEnabled: settings.announcementBarEnabled,
    announcementText: settings.announcementBarText,
    announcementHref: settings.announcementBarHref,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    socialLinks: settings.socialLinks,
    categories: rootCategories,
  };
}

export function normalizeTaxDecimal(taxRatePercent: number): Prisma.Decimal {
  return new Prisma.Decimal((taxRatePercent / 100).toFixed(4));
}
