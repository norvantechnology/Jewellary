import { sanitizePublicOrigin, toAbsoluteUrl } from "@/lib/seo/site";

export const SITEMAP_CHUNK_SIZE = 1000;

export interface SitemapImageEntry {
  url: string;
}

export interface SitemapUrlEntry {
  url: string;
  lastModified?: Date | string | null;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  images?: string[];
}

export interface SitemapIndexEntry {
  url: string;
  lastModified?: Date | string | null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatW3cDate(input?: Date | string | null): string | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function renderUrlSetXml(entries: SitemapUrlEntry[], includeImageNamespace = false): string {
  const hasAnyImages =
    includeImageNamespace || entries.some((entry) => entry.images && entry.images.length > 0);
  const imageNs = hasAnyImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";

  const itemsXml = entries
    .map((entry) => {
      const absLoc = escapeXml(toAbsoluteUrl(entry.url));
      const lastMod = formatW3cDate(entry.lastModified);
      const priority =
        typeof entry.priority === "number"
          ? Math.max(0, Math.min(1, entry.priority)).toFixed(1)
          : null;

      // Per current Google Image Sitemap guidance, only <image:image> + <image:loc> are emitted.
      const imagesXml = (entry.images ?? [])
        .filter(
          (img) =>
            Boolean(img) &&
            !img.trim().toLowerCase().startsWith("data:") &&
            !img.toLowerCase().endsWith(".svg"),
        )
        .slice(0, 1000)
        .map(
          (img) =>
            `    <image:image><image:loc>${escapeXml(toAbsoluteUrl(img))}</image:loc></image:image>`,
        )
        .join("\n");

      return [
        "  <url>",
        `    <loc>${absLoc}</loc>`,
        ...(lastMod ? [`    <lastmod>${escapeXml(lastMod)}</lastmod>`] : []),
        ...(entry.changeFrequency ? [`    <changefreq>${entry.changeFrequency}</changefreq>`] : []),
        ...(priority ? [`    <priority>${priority}</priority>`] : []),
        ...(imagesXml ? [imagesXml] : []),
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>`,
    itemsXml,
    "</urlset>",
    "",
  ].join("\n");
}

export function renderSitemapIndexXml(entries: SitemapIndexEntry[]): string {
  const itemsXml = entries
    .map((entry) => {
      const lastMod = formatW3cDate(entry.lastModified);
      return [
        "  <sitemap>",
        `    <loc>${escapeXml(toAbsoluteUrl(entry.url))}</loc>`,
        ...(lastMod ? [`    <lastmod>${escapeXml(lastMod)}</lastmod>`] : []),
        "  </sitemap>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    itemsXml,
    "</sitemapindex>",
    "",
  ].join("\n");
}

export function createXmlResponseHeaders(maxAgeSeconds = 3600): HeadersInit {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 6}`,
    "X-Content-Type-Options": "nosniff",
  };
}

export function normalizeCanonicalSiteHost(origin: string): string {
  return sanitizePublicOrigin(origin);
}
