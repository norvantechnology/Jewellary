import { isDecorativePlaceholderUrl } from "@/lib/seo/images";
import { validateSeoCopy } from "@/lib/seo/templates";

export interface SeoChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  severity: "pass" | "warning" | "error";
  detail: string;
}

export interface EntitySeoScoreResult {
  score: number;
  grade: "Excellent" | "Good" | "Needs Attention" | "Critical";
  items: SeoChecklistItem[];
}

export function computeProductSeoScore(input: {
  name: string;
  slug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  resolvedTitle: string;
  resolvedDescription: string;
  seoKeywords?: string | null;
  primaryImageUrl?: string | null;
  primaryImageWidth?: number | null;
  primaryImageHeight?: number | null;
  primaryAltText?: string | null;
  imageCount: number;
  hasSpecs: boolean;
}): EntitySeoScoreResult {
  const items: SeoChecklistItem[] = [];
  const textIssues = validateSeoCopy({
    name: input.name,
    slug: input.slug,
    title: input.resolvedTitle,
    description: input.resolvedDescription,
  });

  const hasPlaceholderError = textIssues.some((i) => i.code === "PLACEHOLDER_OR_TEST_TOKEN");
  items.push({
    id: "clean-naming",
    label: "Clean product name & slug",
    passed: !hasPlaceholderError,
    severity: hasPlaceholderError ? "error" : "pass",
    detail: hasPlaceholderError
      ? "Test/placeholder tokens detected in product title or slug."
      : "Slug and product name contain clean descriptive wording.",
  });

  const titleLen = input.resolvedTitle.trim().length;
  const titleOk = titleLen >= 25 && titleLen <= 60;
  items.push({
    id: "title-length",
    label: "Title length (25–60 chars)",
    passed: titleOk,
    severity: titleOk ? "pass" : "warning",
    detail: `${titleLen} characters (${input.seoTitle ? "custom override" : "template-generated"}).`,
  });

  const descLen = input.resolvedDescription.trim().length;
  const descOk = descLen >= 120 && descLen <= 158;
  items.push({
    id: "desc-length",
    label: "Meta description (120–158 chars)",
    passed: descOk,
    severity: descOk ? "pass" : "warning",
    detail: `${descLen} characters (${input.seoDescription ? "custom override" : "template-generated"}).`,
  });

  const hasRealImage = !isDecorativePlaceholderUrl(input.primaryImageUrl);
  const longEdge = Math.max(input.primaryImageWidth ?? 0, input.primaryImageHeight ?? 0);
  const imageOk = hasRealImage && longEdge >= 1200;
  items.push({
    id: "hero-image",
    label: "Primary photo >= 1200px",
    passed: imageOk,
    severity: !hasRealImage ? "error" : imageOk ? "pass" : "warning",
    detail: !hasRealImage
      ? "Missing real uploaded product photograph (SVG placeholder only)."
      : imageOk
        ? `${input.primaryImageWidth}×${input.primaryImageHeight}px primary image.`
        : `Low resolution (${input.primaryImageWidth ?? 0}×${input.primaryImageHeight ?? 0}px); aim for >=1200px.`,
  });

  const altLen = input.primaryAltText?.trim().length ?? 0;
  const altOk =
    altLen >= 12 && altLen <= 125 && !/^image of|^photo of/i.test(input.primaryAltText ?? "");
  items.push({
    id: "alt-text",
    label: "Descriptive image alt text",
    passed: altOk,
    severity: altLen < 3 ? "error" : altOk ? "pass" : "warning",
    detail: altLen < 3 ? "Missing alt text." : `${altLen} chars.`,
  });

  const multiAnglesOk = input.imageCount >= 4;
  items.push({
    id: "gallery-depth",
    label: "Multi-angle gallery (4+ photos)",
    passed: multiAnglesOk,
    severity: multiAnglesOk ? "pass" : "warning",
    detail: `${input.imageCount} uploaded angle(s).`,
  });

  items.push({
    id: "gem-specs",
    label: "Gemology specs for rich snippets",
    passed: input.hasSpecs,
    severity: input.hasSpecs ? "pass" : "warning",
    detail: input.hasSpecs
      ? "Carat, metal & certification populated for Merchant & ProductGroup schema."
      : "Add metal, carat, and certification lab for richer Google Shopping snippets.",
  });

  const hasKw = Boolean(input.seoKeywords?.trim());
  items.push({
    id: "keywords",
    label: "Target search keywords assigned",
    passed: hasKw,
    severity: hasKw ? "pass" : "warning",
    detail: hasKw ? input.seoKeywords!.trim() : "Optional focus keyword helps track intent.",
  });

  const weights = [20, 15, 15, 20, 10, 5, 10, 5];
  const score = items.reduce(
    (sum, item, idx) =>
      sum +
      (item.passed
        ? weights[idx]!
        : item.severity === "warning"
          ? Math.floor(weights[idx]! / 2)
          : 0),
    0,
  );

  const grade: EntitySeoScoreResult["grade"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Attention" : "Critical";

  return { score, grade, items };
}

export function normalizeRedirectPathInput(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.pathname}${parsed.search}`.toLowerCase() || "/";
    } catch {
      return trimmed.toLowerCase();
    }
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.replace(/\/+$/, "").toLowerCase();
  }
  return withSlash.toLowerCase();
}

export function detectRedirectLoopOrChain(
  fromPath: string,
  toPath: string | null,
  existingMap: Map<string, string | null>,
): { hasLoop: boolean; chainLength: number; finalTarget: string | null } {
  if (!toPath) {
    return { hasLoop: false, chainLength: 0, finalTarget: null };
  }
  const normalizedFrom = normalizeRedirectPathInput(fromPath);
  const normalizedTo = normalizeRedirectPathInput(toPath);
  if (normalizedFrom === normalizedTo) {
    return { hasLoop: true, chainLength: 1, finalTarget: normalizedTo };
  }

  const visited = new Set<string>([normalizedFrom, normalizedTo]);
  let cursor: string | null = normalizedTo;
  let hops = 1;

  while (cursor && hops <= 10) {
    const next = existingMap.get(cursor);
    if (!next) break;
    const normNext = normalizeRedirectPathInput(next);
    if (visited.has(normNext)) {
      return { hasLoop: true, chainLength: hops + 1, finalTarget: normNext };
    }
    visited.add(normNext);
    cursor = normNext;
    hops += 1;
  }

  return { hasLoop: false, chainLength: hops, finalTarget: cursor };
}
