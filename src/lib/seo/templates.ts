import { SITE_CONTENT_DEFAULTS } from "@/modules/site-content/site-content.shared";

export interface SeoTemplateVariables {
  name?: string | null;
  category?: string | null;
  metal?: string | null;
  carat?: string | number | null;
  cert?: string | null;
  brand?: string | null;
  price?: string | null;
  collection?: string | null;
  page?: number | string | null;
  count?: number | string | null;
  priceRange?: string | null;
  excerpt?: string | null;
}

export interface SeoTemplatesConfig {
  homeTitle: string;
  homeDescription: string;
  productTitle: string;
  productDescription: string;
  collectionTitle: string;
  collectionDescription: string;
  facetTitle: string;
  facetDescription: string;
  guideTitle: string;
  guideDescription: string;
  pageTitle: string;
  pageDescription: string;
}

/**
 * Automatic SEO wording lives in data/frontend/site-content.json → site.seoTemplates (file-only).
 * Admin > SEO > Templates can override the product/collection templates per store.
 */
export const SEO_TEMPLATE_TEXT = SITE_CONTENT_DEFAULTS.site.seoTemplates;

export const DEFAULT_SEO_TEMPLATES: SeoTemplatesConfig = {
  homeTitle: SEO_TEMPLATE_TEXT.homeTitle,
  homeDescription: SEO_TEMPLATE_TEXT.homeDescription,
  productTitle: SEO_TEMPLATE_TEXT.productTitle,
  productDescription: SEO_TEMPLATE_TEXT.productDescription,
  collectionTitle: SEO_TEMPLATE_TEXT.collectionTitle,
  collectionDescription: SEO_TEMPLATE_TEXT.collectionDescription,
  facetTitle: SEO_TEMPLATE_TEXT.facetTitle,
  facetDescription: SEO_TEMPLATE_TEXT.facetDescription,
  guideTitle: SEO_TEMPLATE_TEXT.guideTitle,
  guideDescription: SEO_TEMPLATE_TEXT.guideDescription,
  pageTitle: SEO_TEMPLATE_TEXT.pageTitle,
  pageDescription: SEO_TEMPLATE_TEXT.pageDescription,
};

/** Replaces {name}-style placeholders in a template from site.seoTemplates. */
export function fillSeoText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function mergeSeoTemplates(raw?: Partial<SeoTemplatesConfig> | null): SeoTemplatesConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SEO_TEMPLATES };
  }
  return {
    homeTitle: raw.homeTitle?.trim() || DEFAULT_SEO_TEMPLATES.homeTitle,
    homeDescription: raw.homeDescription?.trim() || DEFAULT_SEO_TEMPLATES.homeDescription,
    productTitle: raw.productTitle?.trim() || DEFAULT_SEO_TEMPLATES.productTitle,
    productDescription: raw.productDescription?.trim() || DEFAULT_SEO_TEMPLATES.productDescription,
    collectionTitle: raw.collectionTitle?.trim() || DEFAULT_SEO_TEMPLATES.collectionTitle,
    collectionDescription:
      raw.collectionDescription?.trim() || DEFAULT_SEO_TEMPLATES.collectionDescription,
    facetTitle: raw.facetTitle?.trim() || DEFAULT_SEO_TEMPLATES.facetTitle,
    facetDescription: raw.facetDescription?.trim() || DEFAULT_SEO_TEMPLATES.facetDescription,
    guideTitle: raw.guideTitle?.trim() || DEFAULT_SEO_TEMPLATES.guideTitle,
    guideDescription: raw.guideDescription?.trim() || DEFAULT_SEO_TEMPLATES.guideDescription,
    pageTitle: raw.pageTitle?.trim() || DEFAULT_SEO_TEMPLATES.pageTitle,
    pageDescription: raw.pageDescription?.trim() || DEFAULT_SEO_TEMPLATES.pageDescription,
  };
}

export function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*#{1,6}\s+(.+)$/gm, "$1.")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~#>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTemplateArtifacts(text: string): string {
  return text
    .replace(/\(\s*\)/g, "")
    .replace(/\bct\b(?=\s*(?:[|,–-]|$))(?<!\d\s*ct)/gi, "")
    .replace(/,\s*(?=\s*[|–-]|$)/g, "")
    .replace(/[–-]\s*(?=\s*\||$)/g, "")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/\s*[–-]\s*[–-]+\s*/g, " – ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s*\|\s*\|+/g, " | ")
    .replace(/^[\s,|–-]+/, "")
    .replace(/[\s,|–-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncates text strictly at a word boundary without exceeding `maxChars`.
 */
export function truncateAtWordBoundary(input: string, maxChars: number): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const slice = normalized.slice(0, maxChars + 1);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxChars * 0.45)) {
    return slice
      .slice(0, lastSpace)
      .replace(/[,:;–\-|]+$/, "")
      .trim();
  }
  return normalized
    .slice(0, maxChars)
    .replace(/[,:;–\-|]+$/, "")
    .trim();
}

/**
 * Formats an SEO title, enforcing a <= 60 character budget at word boundaries
 * while preserving the brand suffix whenever room permits.
 */
export function finalizeSeoTitle(
  rawTitle: string,
  options?: { maxLength?: number; brandName?: string; pageNumber?: number },
): string {
  const maxLength = options?.maxLength ?? 60;
  let cleaned = cleanTemplateArtifacts(stripMarkup(rawTitle));

  if (options?.pageNumber && options.pageNumber > 1) {
    const pageSuffix = ` – Page ${options.pageNumber}`;
    if (!cleaned.toLowerCase().includes(`page ${options.pageNumber}`)) {
      const brand = options.brandName?.trim();
      if (brand && cleaned.endsWith(`| ${brand}`)) {
        const prefix = cleaned.slice(0, -`| ${brand}`.length).trim();
        const availableForPrefix = maxLength - pageSuffix.length - ` | ${brand}`.length;
        if (availableForPrefix >= 12) {
          cleaned = `${truncateAtWordBoundary(prefix, availableForPrefix)}${pageSuffix} | ${brand}`;
          return cleaned;
        }
      }
      const available = maxLength - pageSuffix.length;
      if (available >= 12) {
        return `${truncateAtWordBoundary(cleaned, available)}${pageSuffix}`;
      }
    }
  }

  if (cleaned.length <= maxLength) return cleaned;

  const brand = options?.brandName?.trim();
  if (brand && cleaned.endsWith(`| ${brand}`)) {
    const brandTail = ` | ${brand}`;
    const availableLeft = maxLength - brandTail.length;
    if (availableLeft >= 18) {
      const left = cleaned.slice(0, -brandTail.length).trim();
      const shortLeft = truncateAtWordBoundary(left, availableLeft);
      const combined = cleanTemplateArtifacts(`${shortLeft}${brandTail}`);
      if (combined.length <= maxLength) return combined;
    }
  }

  // If title has an em/en-dash descriptor and brand suffix, trim descriptor before cutting name
  const pipeIndex = cleaned.lastIndexOf(" | ");
  const dashMatch = cleaned.match(/^(.+?)\s+[–—-]\s+([^|]+)(?:\s+\|\s+(.+))?$/);
  if (dashMatch) {
    const baseName = dashMatch[1]!.trim();
    const trailingBrand = dashMatch[3]?.trim() ?? brand;
    if (trailingBrand) {
      const compact = `${baseName} | ${trailingBrand}`;
      if (compact.length <= maxLength) return compact;
    }
  }
  if (pipeIndex > 0) {
    const firstPart = cleaned.slice(0, pipeIndex).trim();
    if (firstPart.length <= maxLength && firstPart.length >= 24) {
      return truncateAtWordBoundary(cleaned, maxLength);
    }
  }

  return truncateAtWordBoundary(cleaned, maxLength);
}

/**
 * Formats an SEO meta description targeting 120–158 characters cleanly.
 */
export function finalizeSeoDescription(rawDescription: string, fallbackContext?: string): string {
  let cleaned = cleanTemplateArtifacts(stripMarkup(rawDescription));
  if (!cleaned && fallbackContext) {
    cleaned = cleanTemplateArtifacts(stripMarkup(fallbackContext));
  }

  if (cleaned.length < 120 && fallbackContext) {
    const context = cleanTemplateArtifacts(stripMarkup(fallbackContext));
    if (context && !cleaned.toLowerCase().includes(context.toLowerCase())) {
      const sep = cleaned.endsWith(".") ? " " : ". ";
      cleaned = `${cleaned}${sep}${context}`;
    }
  }

  if (cleaned.length <= 158) return cleaned;

  const truncated = truncateAtWordBoundary(cleaned, 155);
  return truncated.endsWith(".") ? truncated : `${truncated}.`;
}

export function interpolateSeoTemplate(template: string, variables: SeoTemplateVariables): string {
  const caratStr =
    variables.carat !== null &&
    variables.carat !== undefined &&
    String(variables.carat).trim() !== ""
      ? String(variables.carat).trim()
      : "";

  const replacements: Record<string, string> = {
    name: variables.name?.trim() ?? "",
    category: variables.category?.trim() ?? "",
    metal: variables.metal?.trim() ?? "",
    carat: caratStr,
    cert: variables.cert?.trim() ?? "",
    brand: variables.brand?.trim() ?? SITE_CONTENT_DEFAULTS.siteConfig.brandName,
    price: variables.price?.trim() ?? "",
    collection: variables.collection?.trim() ?? variables.category?.trim() ?? "",
    page: variables.page ? String(variables.page) : "",
    count: variables.count !== undefined && variables.count !== null ? String(variables.count) : "",
    priceRange: variables.priceRange?.trim() ?? "",
    excerpt: variables.excerpt?.trim() ?? "",
  };

  let output = template;
  for (const [key, val] of Object.entries(replacements)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, "g"), val);
  }
  return cleanTemplateArtifacts(output);
}

export interface SeoTextValidationIssue {
  code:
    | "PLACEHOLDER_OR_TEST_TOKEN"
    | "LOCALHOST_OR_DEMO_URL"
    | "TITLE_TOO_LONG"
    | "TITLE_TOO_SHORT"
    | "DESCRIPTION_TOO_LONG"
    | "DESCRIPTION_TOO_SHORT"
    | "KEYWORD_STUFFING"
    | "MISSING_VALUE";
  severity: "error" | "warning";
  message: string;
}

const RAW_TEST_TOKEN_PATTERNS: RegExp[] = [
  /\bmwc41pq0\b/i,
  /\blorem\s+ipsum\b/i,
  /\btest[-_\s]*(?:product|item|ring|category|guide|page)\b/i,
  /\b(?:asdf|qwerty|foobar|dummy|sample[-_\s]*sku)\b/i,
  /\bplaceholder\b/i,
  /\btodo\b/i,
  // Random id suffix like "-mwc41pq0" (must mix letters and digits, so real words such as
  // "-pendant", "-necklace" or "-earrings" don't match).
  /-(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{7,8}$/i,
];

/**
 * Flags raw test identifiers, placeholder text, localhost URLs, keyword stuffing,
 * and suboptimal metadata lengths.
 */
export function validateSeoCopy(input: {
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  name?: string | null;
}): SeoTextValidationIssue[] {
  const issues: SeoTextValidationIssue[] = [];
  const fieldsToScan = [input.name, input.title, input.description, input.slug].filter(
    Boolean,
  ) as string[];

  for (const value of fieldsToScan) {
    if (RAW_TEST_TOKEN_PATTERNS.some((re) => re.test(value.trim()))) {
      issues.push({
        code: "PLACEHOLDER_OR_TEST_TOKEN",
        severity: "error",
        message: `Suspicious test or placeholder token detected in "${value.slice(0, 60)}".`,
      });
      break;
    }
    if (/localhost|127\.0\.0\.1|example\.com/i.test(value)) {
      issues.push({
        code: "LOCALHOST_OR_DEMO_URL",
        severity: "error",
        message: "Localhost or placeholder domain must not appear in SEO fields.",
      });
      break;
    }
  }

  const title = input.title?.trim() ?? "";
  if (!title) {
    issues.push({
      code: "MISSING_VALUE",
      severity: "warning",
      message: "Custom SEO title is empty (template fallback will be used).",
    });
  } else {
    if (title.length > 60) {
      issues.push({
        code: "TITLE_TOO_LONG",
        severity: "warning",
        message: `Title is ${title.length} chars (target <= 60).`,
      });
    } else if (title.length < 20) {
      issues.push({
        code: "TITLE_TOO_SHORT",
        severity: "warning",
        message: `Title is ${title.length} chars (recommended 30–60).`,
      });
    }
  }

  const desc = input.description?.trim() ?? "";
  if (!desc) {
    issues.push({
      code: "MISSING_VALUE",
      severity: "warning",
      message: "Custom meta description is empty (template fallback will be used).",
    });
  } else {
    if (desc.length > 158) {
      issues.push({
        code: "DESCRIPTION_TOO_LONG",
        severity: "warning",
        message: `Description is ${desc.length} chars (target 120–158).`,
      });
    } else if (desc.length < 120) {
      issues.push({
        code: "DESCRIPTION_TOO_SHORT",
        severity: "warning",
        message: `Description is ${desc.length} chars (target 120–158).`,
      });
    }

    // Simple keyword stuffing detector: any >=4-letter word repeated >= 4 times
    const words = desc.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    const counts = new Map<string, number>();
    const stopWords = new Set(["with", "from", "that", "this", "your", "gold", "diamond"]);
    for (const w of words) {
      if (stopWords.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    for (const [word, count] of counts.entries()) {
      if (count >= 4) {
        issues.push({
          code: "KEYWORD_STUFFING",
          severity: "warning",
          message: `Word "${word}" repeats ${count} times in description; keep copy natural.`,
        });
        break;
      }
    }
  }

  return issues;
}
