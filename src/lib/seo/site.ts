import siteContentFile from "../../../data/frontend/site-content.json";
import { env } from "@/lib/env";

/** Technical SEO settings live in data/frontend/site-content.json → siteConfig (file-only). */
const config = siteContentFile.siteConfig;

export const CANONICAL_PRODUCTION_ORIGIN = config.canonicalOrigin;
export const SITE_LOCALE = config.locale;
export const SITE_LANGUAGE = config.language;
export const DEFAULT_BRAND_NAME = config.brandName;
export const DEFAULT_LEGAL_NAME = config.legalName;

const LOCAL_OR_PLACEHOLDER_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "example.com",
  "www.example.com",
]);

/**
 * Normalizes a configured origin for public SEO outputs (metadataBase, canonical links,
 * sitemaps, JSON-LD, Merchant feeds) so localhost or placeholder domains never leak.
 */
export function sanitizePublicOrigin(rawOrigin: string): string {
  try {
    const parsed = new URL(rawOrigin);
    if (LOCAL_OR_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
      return CANONICAL_PRODUCTION_ORIGIN;
    }
    const protocol =
      parsed.protocol === "http:" || parsed.protocol === "https:" ? "https:" : parsed.protocol;
    const host = parsed.host.toLowerCase();
    return `${protocol}//${host}`;
  } catch {
    return CANONICAL_PRODUCTION_ORIGIN;
  }
}

/**
 * Returns the canonical public storefront origin without a trailing slash.
 */
export function getSiteUrl(): string {
  // SITE_URL is read at runtime on the server, so one build can be deployed to any domain
  // (staging, preview, production) without rebuilding. NEXT_PUBLIC_SITE_URL is the build-time
  // fallback. Share previews (WhatsApp etc.) only work when this is the real public https domain.
  const runtime = typeof window === "undefined" ? process.env.SITE_URL : undefined;
  return sanitizePublicOrigin(runtime || env.NEXT_PUBLIC_SITE_URL);
}

/**
 * Converts a relative site path into an absolute canonical URL.
 * Preserves external CDN URLs unless they point at local/placeholder hosts.
 */
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const parsed = new URL(pathOrUrl);
      if (LOCAL_OR_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
        return `${getSiteUrl()}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return pathOrUrl;
    } catch {
      return pathOrUrl;
    }
  }
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

/**
 * Normalizes an internal pathname to lowercase without trailing slash (except "/").
 */
export function normalizeSeoPath(pathname: string): string {
  const [pathOnly] = pathname.split(/[?#]/);
  const trimmed = (pathOnly || "/").trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.replace(/\/+$/, "").toLowerCase() || "/";
  }
  return withLeadingSlash.toLowerCase();
}

export const STATIC_INDEXABLE_ROUTES: ReadonlyArray<{
  path: string;
  slug: string;
  label: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}> = config.sitemap as ReadonlyArray<{
  path: string;
  slug: string;
  label: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}>;

export const NOINDEX_PATH_PREFIXES: ReadonlyArray<string> = config.noindexPaths;

export function isNoindexRoutePath(pathname: string): boolean {
  const normalized = normalizeSeoPath(pathname);
  if (/^\/products\/[^/]+\/customize(?:\/|$)/.test(normalized)) {
    return true;
  }
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
