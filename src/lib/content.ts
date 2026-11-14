import "server-only";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { renderSafeMarkdown } from "@/lib/markdown";
import { INDEXABLE_ROBOTS, NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getStaticPageSeo } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent, type SiteContent } from "@/modules/site-content/site-content.service";
import { SITE_CONTENT_DEFAULTS } from "@/modules/site-content/site-content.shared";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export interface StaticEditorialPage {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  updatedAt: string;
  html: string;
}

type EditorialSlug = Exclude<keyof SiteContent["editorial"], `_${string}`>;

function isEditorialSlug(slug: string): slug is EditorialSlug {
  return !slug.startsWith("_") && slug in SITE_CONTENT_DEFAULTS.editorial;
}

/** Long-form pages (About, FAQ, legal…) from data/frontend/site-content.json → `editorial`. */
export async function getEditorialContentPage(slug: string): Promise<StaticEditorialPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings, CACHE_TAGS.siteContent);

  if (!isEditorialSlug(slug)) throw new Error(`Unknown editorial page: ${slug}`);
  const page = (await getSiteContent()).editorial[slug];
  return {
    slug,
    title: page.title,
    eyebrow: page.eyebrow,
    description: page.seo.description,
    updatedAt: page.updatedAt,
    html: await renderSafeMarkdown(page.body),
  };
}

export async function getEditorialMetadata(slug: string): Promise<Metadata> {
  const [page, settings, override] = await Promise.all([
    getEditorialContentPage(slug),
    getPublicStoreSettings(),
    getStaticPageSeo(`/${slug}`),
  ]);
  return buildMetadata({
    title:
      override?.seoTitle ??
      ((await getSiteContent()).editorial[page.slug as EditorialSlug]?.seo.title || page.title),
    description: override?.seoDescription ?? page.description,
    keywords: override?.seoKeywords ?? undefined,
    ogTitle: override?.ogTitle ?? undefined,
    ogDescription: override?.ogDescription ?? undefined,
    images: override?.ogImageUrl
      ? [{ url: override.ogImageUrl, alt: page.title, width: 1200, height: 630 }]
      : undefined,
    pathname: `/${page.slug}`,
    canonical: override?.canonicalOverride ?? `/${page.slug}`,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: override?.noindex ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
  });
}

export async function getEditorialLastModified(_slug: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.siteContent);

  const row = await db.siteContent.findUnique({
    where: { id: "default" },
    select: { updatedAt: true },
  });
  return row?.updatedAt.toISOString() ?? "2026-11-01T00:00:00.000Z";
}
