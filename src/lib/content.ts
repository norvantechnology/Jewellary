import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { formatMoney } from "@/lib/money";
import { renderSafeMarkdown } from "@/lib/markdown";
import { INDEXABLE_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { CACHE_TAGS } from "@/server/cache-tags";

export interface StaticEditorialPage {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  updatedAt: string;
  html: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

export async function getEditorialContentPage(slug: string): Promise<StaticEditorialPage> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);

  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  const filePath = path.join(CONTENT_DIR, `${safeSlug}.md`);
  const [rawFile, settings] = await Promise.all([
    readFile(filePath, "utf8"),
    getPublicStoreSettings(),
  ]);

  const parsed = matter(rawFile);
  const freeShippingFormatted = settings.freeShippingThreshold
    ? formatMoney(settings.freeShippingThreshold, settings.currency)
    : "$1,000";
  const signatureThresholdFormatted = formatMoney(settings.signatureThreshold, settings.currency);

  const interpolated = parsed.content
    .replaceAll("{{siteName}}", settings.storeName)
    .replaceAll("{{contactEmail}}", settings.contactEmail)
    .replaceAll("{{returnWindowDays}}", String(settings.returnWindowDays))
    .replaceAll("{{freeShippingThreshold}}", freeShippingFormatted)
    .replaceAll("{{signatureThreshold}}", signatureThresholdFormatted);

  const html = await renderSafeMarkdown(interpolated);
  const data = parsed.data as Record<string, unknown>;

  return {
    slug: safeSlug,
    title:
      typeof data.title === "string"
        ? data.title.replaceAll("{{siteName}}", settings.storeName)
        : safeSlug,
    eyebrow: typeof data.eyebrow === "string" ? data.eyebrow : "Atelier Journal",
    description:
      typeof data.description === "string"
        ? data.description.replaceAll("{{siteName}}", settings.storeName)
        : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "November 2026",
    html,
  };
}

export async function getEditorialMetadata(slug: string): Promise<Metadata> {
  const [page, settings] = await Promise.all([
    getEditorialContentPage(slug),
    getPublicStoreSettings(),
  ]);
  return buildMetadata({
    title: page.title,
    description: page.description,
    pathname: `/${page.slug}`,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: INDEXABLE_ROBOTS,
  });
}

export async function getEditorialLastModified(slug: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);

  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  const filePath = path.join(CONTENT_DIR, `${safeSlug}.md`);
  try {
    const info = await stat(filePath);
    return info.mtime.toISOString();
  } catch {
    return "2026-01-01T00:00:00.000Z";
  }
}
