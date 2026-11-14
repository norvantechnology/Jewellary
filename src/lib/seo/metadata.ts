import type { Metadata } from "next";
import { env } from "@/lib/env";
import type { RawSearchParams } from "@/lib/search-params";
import {
  DEFAULT_BRAND_NAME,
  SITE_LOCALE,
  getSiteUrl,
  isNoindexRoutePath,
  toAbsoluteUrl,
} from "@/lib/seo/site";
import {
  type SeoTemplateVariables,
  type SeoTemplatesConfig,
  finalizeSeoDescription,
  finalizeSeoTitle,
  interpolateSeoTemplate,
  mergeSeoTemplates,
  SEO_TEMPLATE_TEXT,
  fillSeoText,
} from "@/lib/seo/templates";

export { SITE_LOCALE, getSiteUrl, toAbsoluteUrl };

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
  "currency",
  "fbclid",
  "gclid",
  "ref",
  "session",
]);

/**
 * Determines if a `/collections` query has filter, sort, currency, or tracking parameters
 * beyond clean pagination. Clean pages and `?page=n` (`n > 1`) self-canonicalize and remain
 * indexable; filtered/sorted/tracking variants canonicalize to the clean collection URL with `noindex, follow`.
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
  ogTitle?: string | null;
  description: string;
  ogDescription?: string | null;
  pathname: string;
  canonical?: string | null;
  storeName?: string;
  siteDefaultOgImage?: string | null;
  images?: Array<{ url: string; alt: string; width?: number; height?: number }>;
  /**
   * Generated share image for this page (e.g. `/api/og/product/<slug>?v=…`). Used when no
   * share-friendly (JPEG/PNG) image is given in `images`.
   */
  shareImage?: string;
  type?: "website" | "article";
  robots?: Metadata["robots"];
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
  keywords?: string | string[] | null;
  twitterSite?: string | null;
  alternatesLanguages?: Record<string, string>;
  pagination?: {
    previous?: string | null;
    next?: string | null;
  };
  pinterestProduct?: {
    priceAmount?: string | number | null;
    priceCurrency?: string | null;
    availability?: "instock" | "oos" | "preorder" | "backorder";
  };
}

/** Default share card (home hero photo + headline), see src/app/api/og/default/route.tsx. */
const MAX_TITLE_LENGTH = 60;

export const DEFAULT_OG_IMAGE_PATH = "/api/og/default";

function isGeneratedOgUrl(url: string): boolean {
  return url.startsWith("/api/og/") || /^https?:\/\/[^/]+\/api\/og\//.test(url);
}

function isShareFriendlyImage(url: string | null | undefined): url is string {
  return Boolean(url && /\.(jpe?g|png)$/i.test(url.split("?")[0]!));
}

function guessImageType(url: string): string {
  return /\.png$/i.test(url.split("?")[0]!) ? "image/png" : "image/jpeg";
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const storeName = input.storeName ?? env.NEXT_PUBLIC_SITE_NAME ?? DEFAULT_BRAND_NAME;
  const canonicalUrl = input.canonical
    ? toAbsoluteUrl(input.canonical)
    : toAbsoluteUrl(input.pathname);
  // Google shows ~60 characters. Keep "Title | Brand" when it fits; otherwise drop the brand
  // so the page's own keywords stay visible in search results and share previews.
  const brandedTitle = input.title ? `${input.title} | ${storeName}` : storeName;
  const fullTitle =
    input.absoluteTitle ??
    (input.title && brandedTitle.length > MAX_TITLE_LENGTH ? input.title : brandedTitle);
  const socialTitle = input.ogTitle?.trim() || fullTitle;
  const socialDescription = input.ogDescription?.trim() || input.description;

  // Share previews (WhatsApp, iMessage, Facebook, X...) need an absolute JPEG/PNG URL; WebP/SVG
  // are ignored by several apps. Order: page's own JPEG/PNG → generated card → admin default →
  // site default card.
  const friendlyImages = (input.images ?? []).filter(
    (img) => isShareFriendlyImage(img.url) || isGeneratedOgUrl(img.url),
  );
  const fallbackUrl =
    input.shareImage ??
    (isShareFriendlyImage(input.siteDefaultOgImage) ? input.siteDefaultOgImage : null) ??
    DEFAULT_OG_IMAGE_PATH;
  const resolvedImages = (
    friendlyImages.length > 0
      ? friendlyImages
      : [{ url: fallbackUrl, alt: socialTitle, width: 1200, height: 630 }]
  ).map((img) => {
    const url = toAbsoluteUrl(img.url);
    return {
      url,
      secureUrl: url.startsWith("https://") ? url : undefined,
      type: guessImageType(img.url),
      alt: img.alt || socialTitle,
      width: img.width ?? 1200,
      height: img.height ?? 630,
    };
  });

  const effectiveRobots =
    input.robots ?? (isNoindexRoutePath(input.pathname) ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS);

  const openGraph: Metadata["openGraph"] =
    input.type === "article"
      ? {
          type: "article",
          url: canonicalUrl,
          title: socialTitle,
          description: socialDescription,
          siteName: storeName,
          locale: SITE_LOCALE,
          images: resolvedImages,
          ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
          ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
          ...(input.authors ? { authors: input.authors } : {}),
        }
      : {
          type: "website",
          url: canonicalUrl,
          title: socialTitle,
          description: socialDescription,
          siteName: storeName,
          locale: SITE_LOCALE,
          images: resolvedImages,
        };

  const other: Record<string, string | number | Array<string | number>> = {};
  if (
    input.pinterestProduct?.priceAmount !== undefined &&
    input.pinterestProduct?.priceAmount !== null
  ) {
    other["product:price:amount"] = String(input.pinterestProduct.priceAmount);
    if (input.pinterestProduct.priceCurrency) {
      other["product:price:currency"] = input.pinterestProduct.priceCurrency.toUpperCase();
    }
  }
  if (input.pinterestProduct?.availability) {
    other["og:availability"] = input.pinterestProduct.availability;
  }

  const parsedKeywords = Array.isArray(input.keywords)
    ? input.keywords.filter(Boolean)
    : typeof input.keywords === "string"
      ? input.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined;

  const pagination =
    input.pagination?.previous || input.pagination?.next
      ? {
          ...(input.pagination.previous
            ? { previous: toAbsoluteUrl(input.pagination.previous) }
            : {}),
          ...(input.pagination.next ? { next: toAbsoluteUrl(input.pagination.next) } : {}),
        }
      : undefined;

  return {
    title: { absolute: fullTitle },
    description: input.description,
    ...(parsedKeywords && parsedKeywords.length > 0 ? { keywords: parsedKeywords } : {}),
    ...(input.authors && input.authors.length > 0
      ? { authors: input.authors.map((name) => ({ name })) }
      : {}),
    publisher: storeName,
    applicationName: storeName,
    alternates: {
      canonical: canonicalUrl,
      ...(input.alternatesLanguages && Object.keys(input.alternatesLanguages).length > 0
        ? { languages: input.alternatesLanguages }
        : {}),
    },
    ...(pagination ? { pagination } : {}),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      ...(input.twitterSite ? { site: input.twitterSite } : {}),
      ...(resolvedImages ? { images: resolvedImages.map((img) => img.url) } : {}),
    },
    robots: effectiveRobots,
    ...(Object.keys(other).length > 0 ? { other } : {}),
  };
}

export function formatProductMetaTitle(
  product: {
    name: string;
    seoTitle?: string | null;
    metalType?: string | null;
    caratTotal?: string | number | null;
    certificationLab?: string | null;
    stoneShape?: string | null;
    categoryName?: string | null;
  },
  options?: {
    storeName?: string;
    templates?: Partial<SeoTemplatesConfig> | null;
    priceText?: string | null;
  },
): string {
  const brand = options?.storeName ?? DEFAULT_BRAND_NAME;
  if (product.seoTitle?.trim()) {
    return finalizeSeoTitle(product.seoTitle.trim(), { brandName: brand, maxLength: 60 });
  }
  const templates = mergeSeoTemplates(options?.templates);
  const templated = interpolateSeoTemplate(templates.productTitle, {
    name: product.name,
    category: product.categoryName,
    collection: product.categoryName,
    metal: product.metalType ?? product.stoneShape,
    carat: product.caratTotal,
    cert: product.certificationLab
      ? fillSeoText(SEO_TEMPLATE_TEXT.fallbacks.certifiedLabel, { lab: product.certificationLab })
      : null,
    brand,
    price: options?.priceText,
  });
  return finalizeSeoTitle(templated, { brandName: brand, maxLength: 60 });
}

export function formatProductMetaDescription(
  product: {
    name: string;
    seoDescription?: string | null;
    subtitle?: string | null;
    description?: string | null;
    metalType?: string | null;
    caratTotal?: string | number | null;
    certificationLab?: string | null;
    categoryName?: string | null;
  },
  returnWindowDays: number,
  options?: {
    storeName?: string;
    templates?: Partial<SeoTemplatesConfig> | null;
    priceText?: string | null;
  },
): string {
  if (product.seoDescription?.trim()) {
    return finalizeSeoDescription(product.seoDescription.trim());
  }
  const templates = mergeSeoTemplates(options?.templates);
  const lead = product.subtitle?.trim() || product.description?.trim() || product.name;
  const fallbackSpecs = `${
    product.caratTotal ? `${Number(product.caratTotal).toFixed(2)}ct ` : ""
  }${
    product.certificationLab
      ? fillSeoText(SEO_TEMPLATE_TEXT.fallbacks.certifiedLower, { lab: product.certificationLab })
      : SEO_TEMPLATE_TEXT.fallbacks.independentlyCertified
  }, ${fillSeoText(SEO_TEMPLATE_TEXT.fallbacks.productSpecsSuffix, { days: returnWindowDays })}`;

  if (options?.templates) {
    const vars: SeoTemplateVariables = {
      name: product.name,
      category: product.categoryName,
      collection: product.categoryName,
      metal: product.metalType ?? SEO_TEMPLATE_TEXT.fallbacks.metal,
      carat: product.caratTotal,
      cert: product.certificationLab ?? SEO_TEMPLATE_TEXT.fallbacks.cert,
      brand: options.storeName ?? DEFAULT_BRAND_NAME,
      price: options.priceText ?? SEO_TEMPLATE_TEXT.fallbacks.price,
    };
    const templated = interpolateSeoTemplate(templates.productDescription, vars);
    return finalizeSeoDescription(templated, lead);
  }

  return finalizeSeoDescription(`${lead} — ${fallbackSpecs}`);
}

export function formatCollectionMetaTitle(input: {
  name: string;
  seoTitle?: string | null;
  brandName?: string;
  pageNumber?: number;
  templates?: Partial<SeoTemplatesConfig> | null;
}): string {
  const brand = input.brandName ?? DEFAULT_BRAND_NAME;
  if (input.seoTitle?.trim()) {
    return finalizeSeoTitle(input.seoTitle.trim(), {
      brandName: brand,
      maxLength: 60,
      pageNumber: input.pageNumber,
    });
  }
  const templates = mergeSeoTemplates(input.templates);
  const templated = interpolateSeoTemplate(templates.collectionTitle, {
    name: input.name,
    collection: input.name,
    category: input.name,
    brand,
    page: input.pageNumber,
  });
  return finalizeSeoTitle(templated, {
    brandName: brand,
    maxLength: 60,
    pageNumber: input.pageNumber,
  });
}

export function formatCollectionMetaDescription(input: {
  name: string;
  seoDescription?: string | null;
  description?: string | null;
  count: number;
  priceRange?: string | null;
  brandName?: string;
  templates?: Partial<SeoTemplatesConfig> | null;
}): string {
  if (input.seoDescription?.trim()) {
    return finalizeSeoDescription(input.seoDescription.trim());
  }
  const brand = input.brandName ?? DEFAULT_BRAND_NAME;
  const templates = mergeSeoTemplates(input.templates);
  const fallback = input.description?.trim();
  const interpolated = interpolateSeoTemplate(templates.collectionDescription, {
    name: input.name,
    collection: input.name,
    category: input.name,
    count: input.count > 0 ? input.count : "our",
    priceRange: input.priceRange || SEO_TEMPLATE_TEXT.fallbacks.priceRange,
    brand,
  });
  return finalizeSeoDescription(fallback ? `${fallback} ${interpolated}` : interpolated);
}
