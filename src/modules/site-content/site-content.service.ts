import "server-only";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { formatMoney } from "@/lib/money";
import { INDEXABLE_ROBOTS, NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getStaticPageSeo } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import {
  SITE_CONTENT_DEFAULTS,
  mergeSiteContent,
  stripNonEditable,
  type JsonValue,
  type SiteContent,
} from "@/modules/site-content/site-content.shared";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export type { SiteContent } from "@/modules/site-content/site-content.shared";

function interpolate(value: JsonValue, tokens: Record<string, string>): JsonValue {
  if (typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key: string) => tokens[key] ?? match);
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, tokens)]));
  }
  return value;
}

/** Defaults merged with the admin override, without token replacement (what the editor shows). */
export async function getEditableSiteContent(): Promise<{
  content: SiteContent;
  hasOverride: boolean;
  updatedAt: string | null;
}> {
  const row = await db.siteContent.findUnique({ where: { id: "default" } });
  return {
    content: mergeSiteContent(
      SITE_CONTENT_DEFAULTS as unknown as JsonValue,
      row ? stripNonEditable(row.data) : undefined,
    ) as unknown as SiteContent,
    hasOverride: Boolean(row),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** Page content for rendering: defaults + admin edits, with {{tokens}} filled from store settings. */
export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.siteContent, CACHE_TAGS.settings);

  const [{ content }, settings] = await Promise.all([
    getEditableSiteContent(),
    getPublicStoreSettings(),
  ]);
  const tokens: Record<string, string> = {
    siteName: settings.storeName,
    contactEmail: settings.contactEmail,
    returnWindowDays: String(settings.returnWindowDays),
    freeShippingThreshold: settings.freeShippingThreshold
      ? formatMoney(settings.freeShippingThreshold, settings.currency)
      : "",
    signatureThreshold: formatMoney(settings.signatureThreshold, settings.currency),
  };
  return interpolate(content as unknown as JsonValue, tokens) as unknown as SiteContent;
}

interface PageSeo {
  title: string;
  description: string;
}

/**
 * Page metadata from the content file's `seo` block, with any per-page overrides from
 * Admin > SEO (title, description, OG, canonical, noindex) applied on top.
 */
export async function buildPageMetadata(
  pick: (content: SiteContent) => PageSeo,
  options: {
    pathname: string;
    canonical?: string;
    robots?: Metadata["robots"];
    /** Use the title as-is instead of "Title | Store". */
    absoluteTitle?: boolean;
  },
): Promise<Metadata> {
  const [content, settings, override] = await Promise.all([
    getSiteContent(),
    getPublicStoreSettings(),
    getStaticPageSeo(options.pathname === "/" ? "/" : options.pathname),
  ]);
  const seo = pick(content);
  const title = override?.seoTitle ?? seo.title;
  return buildMetadata({
    ...(options.absoluteTitle ? { absoluteTitle: title } : { title }),
    description: override?.seoDescription ?? (seo.description || settings.tagline || ""),
    keywords: override?.seoKeywords ?? undefined,
    ogTitle: override?.ogTitle ?? undefined,
    ogDescription: override?.ogDescription ?? undefined,
    images: override?.ogImageUrl
      ? [{ url: override.ogImageUrl, alt: title, width: 1200, height: 630 }]
      : undefined,
    pathname: options.pathname,
    canonical: override?.canonicalOverride ?? options.canonical ?? options.pathname,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: override?.noindex ? NOINDEX_FOLLOW_ROBOTS : (options.robots ?? INDEXABLE_ROBOTS),
  });
}
