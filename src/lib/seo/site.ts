import { env } from "@/lib/env";

export const CANONICAL_PRODUCTION_ORIGIN = "https://maisonaurelia.com";
export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en-US";
export const DEFAULT_BRAND_NAME = "Maison Aurelia";
export const DEFAULT_LEGAL_NAME = "Maison Aurelia Fine Jewellery Ltd.";

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
  return sanitizePublicOrigin(env.NEXT_PUBLIC_SITE_URL);
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
}> = [
  { path: "/", slug: "/", label: "Home", priority: 1.0, changeFrequency: "daily" },
  {
    path: "/collections",
    slug: "collections",
    label: "All Collections",
    priority: 0.9,
    changeFrequency: "daily",
  },
  {
    path: "/guides",
    slug: "guides",
    label: "Atelier Journal",
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    path: "/about",
    slug: "about",
    label: "Atelier Heritage",
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/contact",
    slug: "contact",
    label: "Private Concierge",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/faq",
    slug: "faq",
    label: "Frequently Asked Questions",
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/shipping-returns",
    slug: "shipping-returns",
    label: "Shipping & Returns",
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/ring-size-guide",
    slug: "ring-size-guide",
    label: "Ring Size Guide",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/care-guide",
    slug: "care-guide",
    label: "Fine Jewellery Care Guide",
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/newsletter",
    slug: "newsletter",
    label: "Newsletter",
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    path: "/privacy",
    slug: "privacy",
    label: "Privacy Policy",
    priority: 0.3,
    changeFrequency: "yearly",
  },
  {
    path: "/terms",
    slug: "terms",
    label: "Terms of Service",
    priority: 0.3,
    changeFrequency: "yearly",
  },
];

export const NOINDEX_PATH_PREFIXES = [
  "/cart",
  "/checkout",
  "/account",
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/orders",
  "/wishlist",
  "/search",
  "/customize",
  "/dev",
  "/api",
] as const;

export function isNoindexRoutePath(pathname: string): boolean {
  const normalized = normalizeSeoPath(pathname);
  if (/^\/products\/[^/]+\/customize(?:\/|$)/.test(normalized)) {
    return true;
  }
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
