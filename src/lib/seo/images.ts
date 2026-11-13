import { slugify } from "@/lib/slug";

export const IMAGE_VIEW_TYPES = [
  "front",
  "side",
  "detail",
  "on-hand",
  "lifestyle",
  "packaging",
  "certificate",
] as const;

export type ImageViewType = (typeof IMAGE_VIEW_TYPES)[number];

export const IMAGE_VIEW_LABELS: Record<ImageViewType, string> = {
  front: "front view",
  side: "side profile",
  detail: "close-up detail",
  "on-hand": "worn on hand",
  lifestyle: "editorial styling",
  packaging: "atelier presentation box",
  certificate: "gemological certificate",
};

export const IMAGE_RESPONSIVE_WIDTHS = [320, 480, 640, 800, 1080, 1280, 1600, 2000] as const;

export const IMAGE_QUALITY_BUDGETS = {
  recommendedMinEdgePx: 1200,
  warningMinEdgePx: 800,
  heroAvifMaxBytes: 200 * 1024,
} as const;

export interface ResponsiveVariantSet {
  widths: Record<
    string,
    {
      avif?: string;
      webp?: string;
      jpeg?: string;
    }
  >;
  crops?: {
    ratio1x1?: string;
    ratio4x3?: string;
    ratio4x5?: string;
    ratio16x9?: string;
  };
  seoFilenameStem?: string;
  byteSizes?: {
    avif?: number;
    webp?: number;
    jpeg?: number;
  };
}

export function normalizeImageViewType(raw?: string | null): ImageViewType {
  const normalized = (raw ?? "front").trim().toLowerCase() as ImageViewType;
  return IMAGE_VIEW_TYPES.includes(normalized) ? normalized : "front";
}

/**
 * Generates an SEO-friendly deterministic filename stem:
 * `{product-slug}-{metal}-{carat}ct-{view}` (e.g. `clairvoyant-studs-18k-white-gold-1-5ct-front`).
 */
export function buildSeoImageStem(input: {
  slug?: string | null;
  productName?: string | null;
  metal?: string | null;
  carat?: string | number | null;
  viewType?: string | null;
  index?: number;
  hashSuffix?: string;
}): string {
  const parts: string[] = [];
  const base = slugify(input.slug || input.productName || "maison-aurelia-piece");
  if (base) parts.push(base);

  if (input.metal?.trim()) {
    parts.push(slugify(input.metal));
  }
  if (input.carat !== null && input.carat !== undefined && String(input.carat).trim() !== "") {
    const cleanCarat = String(input.carat)
      .trim()
      .replace(/(\.\d*?[1-9])0+$/, "$1")
      .replace(/\.0+$/, "")
      .replace(/[^0-9.]/g, "")
      .replace(/\./g, "-");
    if (cleanCarat) parts.push(`${cleanCarat}ct`);
  }

  const view = normalizeImageViewType(input.viewType);
  parts.push(view);

  if (typeof input.index === "number" && input.index > 0) {
    parts.push(String(input.index + 1));
  }
  if (input.hashSuffix?.trim()) {
    parts.push(slugify(input.hashSuffix).slice(0, 8));
  }

  return parts.filter(Boolean).join("-").slice(0, 120);
}

/**
 * Auto-generates descriptive, unique, non-stuffed alt text (<= 125 chars)
 * matching "{Product name}, {metal}, {carat}ct {shape} {cert}, {view}".
 */
export function buildAutoProductImageAlt(input: {
  productName: string;
  metal?: string | null;
  carat?: string | number | null;
  shape?: string | null;
  cert?: string | null;
  viewType?: string | null;
}): string {
  const segments: string[] = [input.productName.trim()];
  if (input.metal?.trim()) segments.push(input.metal.trim());

  const stoneBits: string[] = [];
  if (input.carat !== null && input.carat !== undefined && String(input.carat).trim() !== "") {
    stoneBits.push(`${String(input.carat).trim()}ct`);
  }
  if (input.shape?.trim()) stoneBits.push(input.shape.trim());
  if (input.cert?.trim()) stoneBits.push(`${input.cert.trim()} certified`);
  if (stoneBits.length > 0) segments.push(stoneBits.join(" "));

  const view = normalizeImageViewType(input.viewType);
  segments.push(IMAGE_VIEW_LABELS[view]);

  const raw = segments.join(", ").replace(/\s+/g, " ").trim();
  if (raw.length <= 125) return raw;

  const sliced = raw.slice(0, 125);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 60 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\s-]+$/, "");
}

export function isDecorativePlaceholderUrl(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return !trimmed || trimmed.startsWith("data:image/svg") || trimmed.endsWith(".svg");
}
