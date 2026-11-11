import type { CollectionQueryInput, CollectionSortOption } from "@/modules/catalog/catalog.public";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const VALID_SORTS = new Set<CollectionSortOption>([
  "featured",
  "price-asc",
  "price-desc",
  "newest",
  "carat-desc",
]);

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

function toSingleString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0]?.trim() : value.trim();
}

function toPositiveNumber(value: string | string[] | undefined): number | undefined {
  const raw = toSingleString(value);
  if (!raw) return undefined;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return num;
}

export function parseCatalogFilterParams(raw: RawSearchParams): CollectionQueryInput & {
  q?: string;
} {
  const rawSort = toSingleString(raw.sort) as CollectionSortOption | undefined;
  const sort: CollectionSortOption = rawSort && VALID_SORTS.has(rawSort) ? rawSort : "featured";
  const rawPage = toPositiveNumber(raw.page);
  const page = rawPage && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return {
    q: toSingleString(raw.q)?.slice(0, 100) || undefined,
    metal: toStringArray(raw.metal),
    shape: toStringArray(raw.shape),
    origin: toStringArray(raw.origin),
    color: toStringArray(raw.color),
    clarity: toStringArray(raw.clarity),
    certification: toStringArray(raw.certification),
    minPrice: toPositiveNumber(raw.minPrice),
    maxPrice: toPositiveNumber(raw.maxPrice),
    minCarat: toPositiveNumber(raw.minCarat),
    maxCarat: toPositiveNumber(raw.maxCarat),
    inStock: toSingleString(raw.inStock) === "1",
    featured: toSingleString(raw.featured) === "1",
    newArrival: toSingleString(raw.new) === "1",
    bestseller: toSingleString(raw.bestseller) === "1",
    sort,
    page,
  };
}

export function buildCatalogPageHref(basePath: string, raw: RawSearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(raw)) {
    if (key === "page" || val === undefined) continue;
    if (Array.isArray(val)) {
      for (const entry of val) {
        if (entry) params.append(key, entry);
      }
    } else if (val) {
      params.set(key, val);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
