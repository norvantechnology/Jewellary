import type { Metadata } from "next";
import { env } from "@/lib/env";
import type { RawSearchParams } from "@/lib/search-params";

export const SITE_LOCALE = "en_US";

export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_FOLLOW_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
};

export const NOINDEX_NOFOLLOW_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
};

const COLLECTION_NON_CANONICAL_KEYS = new Set([
  "metal",
  "shape",
  "origin",
  "color",
  "clarity",
  "certification",
  "minPrice",
  "maxPrice",
  "minCarat",
  "maxCarat",
  "inStock",
  "featured",
  "new",
  "bestseller",
  "sort",
]);

/**
 * Determines if a `/collections` query has filter/sort/tracking parameters beyond a clean paginated view.
 * Clean pages and `?page=n` (`n > 1`) self-canonicalise and remain indexable; filtered/sorted views
 * canonicalise to the clean collection path and carry `noindex, follow`.
 */
export function hasNonCanonicalCollectionQuery(rawSearch: RawSearchParams): boolean {
  for (const [key, value] of Object.entries(rawSearch)) {
    if (value === undefined) continue;
    const str = Array.isArray(value) ? value.join("") : value;
    if (!str.trim()) continue;
    if (key === "page") continue;
    if (COLLECTION_NON_CANONICAL_KEYS.has(key) || key.startsWith("utm_")) {
      return true;
    }
    return true;
  }
  return false;
}

export function buildCollectionCanonicalPath(
  basePath: string,
  rawSearch: RawSearchParams,
): {
  canonicalPath: string;
  isFiltered: boolean;
} {
  const isFiltered = hasNonCanonicalCollectionQuery(rawSearch);
  if (isFiltered) {
    return { canonicalPath: basePath, isFiltered: true };
  }
  const rawPage = Array.isArray(rawSearch.page) ? rawSearch.page[0] : rawSearch.page;
  const pageNum = rawPage ? Number(rawPage) : 1;
  if (Number.isInteger(pageNum) && pageNum > 1) {
    return { canonicalPath: `${basePath}?page=${pageNum}`, isFiltered: false };
  }
  return { canonicalPath: basePath, isFiltered: false };
}

export interface BuildMetadataInput {
  title?: string;
  absoluteTitle?: string;
  description: string;
  pathname: string;
  canonical?: string | null;
  storeName?: string;
  siteDefaultOgImage?: string | null;
  images?: Array<{ url: string; alt: string; width?: number; height?: number }>;
  /** Set true on route segments that define their own `opengraph-image.tsx` file convention. */
  useSegmentOgImage?: boolean;
  type?: "website" | "article";
  robots?: Metadata["robots"];
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const storeName = input.storeName ?? env.NEXT_PUBLIC_SITE_NAME;
  const canonicalUrl = input.canonical
    ? toAbsoluteUrl(input.canonical)
    : toAbsoluteUrl(input.pathname);
  const fullTitle =
    input.absoluteTitle ?? (input.title ? `${input.title} | ${storeName}` : storeName);

  const hasExplicitImages = Boolean(input.images && input.images.length > 0);
  const fallbackOg = input.siteDefaultOgImage
    ? toAbsoluteUrl(input.siteDefaultOgImage)
    : input.useSegmentOgImage
      ? null
      : toAbsoluteUrl("/opengraph-image");

  const resolvedImages = hasExplicitImages
    ? input.images!.map((img) => ({
        url: toAbsoluteUrl(img.url),
        alt: img.alt,
        width: img.width ?? 1200,
        height: img.height ?? 630,
      }))
    : fallbackOg
      ? [
          {
            url: fallbackOg,
            alt: fullTitle,
            width: 1200,
            height: 630,
          },
        ]
      : undefined;

  const openGraph: Metadata["openGraph"] =
    input.type === "article"
      ? {
          type: "article",
          url: canonicalUrl,
          title: fullTitle,
          description: input.description,
          siteName: storeName,
          locale: SITE_LOCALE,
          ...(resolvedImages ? { images: resolvedImages } : {}),
          ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
          ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
          ...(input.authors ? { authors: input.authors } : {}),
        }
      : {
          type: "website",
          url: canonicalUrl,
          title: fullTitle,
          description: input.description,
          siteName: storeName,
          locale: SITE_LOCALE,
          ...(resolvedImages ? { images: resolvedImages } : {}),
        };

  return {
    title: input.absoluteTitle ? { absolute: input.absoluteTitle } : input.title,
    description: input.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: input.description,
      ...(resolvedImages ? { images: resolvedImages.map((img) => img.url) } : {}),
    },
    robots: input.robots ?? INDEXABLE_ROBOTS,
  };
}

export function formatProductMetaTitle(product: {
  name: string;
  seoTitle?: string | null;
  metalType?: string | null;
  stoneShape?: string | null;
}): string {
  if (product.seoTitle?.trim()) {
    return product.seoTitle.trim();
  }
  const attr = product.metalType ?? product.stoneShape;
  return attr ? `${product.name} — ${attr}` : product.name;
}

export function formatProductMetaDescription(
  product: {
    name: string;
    seoDescription?: string | null;
    subtitle?: string | null;
    description?: string | null;
    caratTotal?: string | null;
    certificationLab?: string | null;
  },
  returnWindowDays: number,
): string {
  if (product.seoDescription?.trim()) {
    return product.seoDescription.trim().slice(0, 160);
  }
  const lead = product.subtitle ?? product.description ?? product.name;
  const specs = [
    product.caratTotal ? `${Number(product.caratTotal).toFixed(2)} ct` : null,
    product.certificationLab ? `${product.certificationLab} certified` : "Independently certified",
    `insured delivery & ${returnWindowDays}-day returns`,
  ]
    .filter(Boolean)
    .join(" · ");

  const combined = `${lead.replace(/\s+/g, " ").trim()} — ${specs}.`;
  return combined.length <= 160 ? combined : `${combined.slice(0, 157)}...`;
}
