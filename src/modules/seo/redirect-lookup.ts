import { normalizeRedirectPathInput } from "@/lib/seo/audit";
import { db } from "@/server/db";

interface CachedRuleEntry {
  id: string;
  fromPath: string;
  toPath: string | null;
  statusCode: number;
}

const CACHE_TTL_MS = 60_000;
const SLUG_CACHE_TTL_MS = 60_000;
const MAX_SLUG_CACHE_ENTRIES = 2000;

let cachedRules: { expiresAt: number; byPath: Map<string, CachedRuleEntry> } | null = null;
let inFlightRules: Promise<Map<string, CachedRuleEntry>> | null = null;
const slugRedirectCache = new Map<
  string,
  { expiresAt: number; value: ProxyRedirectMatch | null }
>();

export function invalidateRedirectLookupCache(): void {
  cachedRules = null;
  inFlightRules = null;
  slugRedirectCache.clear();
}

async function loadActiveRulesMap(): Promise<Map<string, CachedRuleEntry>> {
  const now = Date.now();
  if (cachedRules && cachedRules.expiresAt > now) {
    return cachedRules.byPath;
  }
  if (inFlightRules) {
    return inFlightRules;
  }

  inFlightRules = (async () => {
    try {
      const rows = await db.redirectRule.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fromPath: true,
          toPath: true,
          statusCode: true,
        },
      });

      const byPath = new Map<string, CachedRuleEntry>();
      for (const row of rows) {
        const fromPath = normalizeRedirectPathInput(row.fromPath);
        if (!byPath.has(fromPath)) {
          byPath.set(fromPath, {
            id: row.id,
            fromPath,
            toPath: row.toPath,
            statusCode: row.statusCode,
          });
        }
      }

      cachedRules = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        byPath,
      };
      return byPath;
    } finally {
      inFlightRules = null;
    }
  })();

  return inFlightRules;
}

async function lookupSlugRedirectCached(
  entityType: "Product" | "Category" | "Article",
  oldSlug: string,
  prefix: string,
): Promise<ProxyRedirectMatch | null> {
  const key = `${entityType}:${oldSlug}`;
  const now = Date.now();
  const cached = slugRedirectCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const hit = await db.slugRedirect.findUnique({
    where: { entityType_oldSlug: { entityType, oldSlug } },
    select: { id: true, newSlug: true, statusCode: true },
  });

  const value: ProxyRedirectMatch | null =
    hit && hit.newSlug !== oldSlug
      ? {
          kind: "slug",
          id: hit.id,
          toPath: `${prefix}${hit.newSlug}`,
          statusCode: hit.statusCode || 301,
          entityType,
          oldSlug,
        }
      : null;

  if (slugRedirectCache.size >= MAX_SLUG_CACHE_ENTRIES) {
    const firstKey = slugRedirectCache.keys().next().value;
    if (firstKey !== undefined) {
      slugRedirectCache.delete(firstKey);
    }
  }
  slugRedirectCache.set(key, { expiresAt: now + SLUG_CACHE_TTL_MS, value });
  return value;
}

export interface ProxyRedirectMatch {
  kind: "rule" | "slug";
  id: string;
  toPath: string | null;
  statusCode: number;
  entityType?: string;
  oldSlug?: string;
}

export async function lookupProxyRedirect(pathname: string): Promise<ProxyRedirectMatch | null> {
  const normalized = normalizeRedirectPathInput(pathname);

  const rulesByPath = await loadActiveRulesMap();
  const rule = rulesByPath.get(normalized);
  if (rule) {
    return {
      kind: "rule",
      id: rule.id,
      toPath: rule.toPath,
      statusCode: rule.statusCode,
    };
  }

  // Also check SlugRedirect for legacy product / category / article URLs so they issue true 301s.
  if (normalized.startsWith("/products/") && !normalized.endsWith("/customize")) {
    const oldSlug = normalized.slice("/products/".length);
    if (oldSlug && !oldSlug.includes("/")) {
      return lookupSlugRedirectCached("Product", oldSlug, "/products/");
    }
  }

  if (normalized.startsWith("/collections/")) {
    const oldSlug = normalized.slice("/collections/".length);
    if (oldSlug) {
      return lookupSlugRedirectCached("Category", oldSlug, "/collections/");
    }
  }

  if (normalized.startsWith("/guides/")) {
    const oldSlug = normalized.slice("/guides/".length);
    if (oldSlug && !oldSlug.includes("/")) {
      return lookupSlugRedirectCached("Article", oldSlug, "/guides/");
    }
  }

  return null;
}
