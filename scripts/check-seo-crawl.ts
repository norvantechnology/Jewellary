import { config } from "dotenv";

config({ path: ".env" });

const BASE_URL = (
  process.env.SEO_CRAWL_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000"
).replace(/\/+$/, "");

const PRIVATE_PREFIXES = [
  "/admin",
  "/api",
  "/cart",
  "/checkout",
  "/account",
  "/orders",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/dev",
  "/_next",
  "/feeds",
];

function extractTagAttrValues(html: string, tag: string, attr: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, "gi");
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) results.push(match[1]);
  }
  return results;
}

function extractXmlLocs(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) locs.push(match[1].trim());
  }
  return locs;
}

function normalizeInternalPath(rawHref: string): string | null {
  if (!rawHref) return null;
  const trimmed = rawHref.trim();
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, BASE_URL);
  } catch {
    return null;
  }

  if (parsed.origin !== new URL(BASE_URL).origin) {
    return null;
  }

  // Skip parameterized filter/query URLs and asset links when building crawl graph
  if (parsed.search || /\.(png|jpe?g|webp|svg|ico|xml|txt|pdf|css|js)$/i.test(parsed.pathname)) {
    return null;
  }

  const normalizedPath =
    parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;

  if (
    PRIVATE_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    )
  ) {
    return null;
  }

  return normalizedPath;
}

interface PageCheckResult {
  url: string;
  status: number;
  title: string | null;
  canonical: string | null;
  description: string | null;
  h1Count: number;
  jsonLdCount: number;
  errors: string[];
}

async function inspectPage(pathname: string): Promise<{
  check: PageCheckResult;
  discoveredPaths: string[];
}> {
  const url = `${BASE_URL}${pathname}`;
  const response = await fetch(url, { redirect: "manual" });
  const errors: string[] = [];
  const discoveredPaths: string[] = [];

  if (response.status >= 300 && response.status < 400) {
    errors.push(
      `Unexpected redirect status ${response.status} to ${response.headers.get("location")}`,
    );
    return {
      check: {
        url,
        status: response.status,
        title: null,
        canonical: null,
        description: null,
        h1Count: 0,
        jsonLdCount: 0,
        errors,
      },
      discoveredPaths,
    };
  }

  if (response.status !== 200) {
    errors.push(`Expected HTTP 200, received ${response.status}`);
    return {
      check: {
        url,
        status: response.status,
        title: null,
        canonical: null,
        description: null,
        h1Count: 0,
        jsonLdCount: 0,
        errors,
      },
      discoveredPaths,
    };
  }

  const html = await response.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;
  if (!title) {
    errors.push("Missing <title>");
  }

  const descMatches = [
    ...html.matchAll(/<meta[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/gi),
    ...html.matchAll(/<meta[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']description["'][^>]*>/gi),
  ];
  const description = descMatches[0]?.[1]?.trim() ?? null;
  if (!description) {
    errors.push('Missing <meta name="description">');
  }

  const canonicalMatches = [
    ...html.matchAll(/<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi),
    ...html.matchAll(/<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/gi),
  ];
  const canonical = canonicalMatches[0]?.[1]?.trim() ?? null;
  if (!canonical) {
    errors.push('Missing <link rel="canonical">');
  }

  const h1Matches = html.match(/<h1[\s>]/gi) ?? [];
  const h1Count = h1Matches.length;
  if (h1Count !== 1) {
    errors.push(`Expected exactly 1 <h1>, found ${h1Count}`);
  }

  const jsonLdScripts = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  let jsonLdCount = 0;
  for (const script of jsonLdScripts) {
    const rawJson = script[1]?.trim();
    if (!rawJson) continue;
    try {
      JSON.parse(rawJson);
      jsonLdCount += 1;
    } catch (err) {
      errors.push(`Invalid JSON-LD block: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (jsonLdCount === 0) {
    errors.push("Missing structured JSON-LD block");
  }

  const rawHrefs = extractTagAttrValues(html, "a", "href");
  for (const href of rawHrefs) {
    const normalized = normalizeInternalPath(href);
    if (normalized) {
      discoveredPaths.push(normalized);
    }
  }

  return {
    check: {
      url,
      status: response.status,
      title,
      canonical,
      description,
      h1Count,
      jsonLdCount,
      errors,
    },
    discoveredPaths,
  };
}

async function main() {
  console.log(`[seo:crawl] Auditing ${BASE_URL}`);
  const failures: string[] = [];

  // 1. Validate /robots.txt
  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  if (robotsRes.status !== 200) {
    failures.push(`GET /robots.txt returned ${robotsRes.status}`);
  } else {
    const robotsText = await robotsRes.text();
    if (!robotsText.includes("Sitemap:")) {
      failures.push("/robots.txt missing Sitemap: directive");
    }
    if (!robotsText.includes("Disallow: /admin")) {
      failures.push("/robots.txt missing Disallow: /admin");
    }
  }

  // 2. Validate /sitemap.xml index and all segmented child sitemaps
  const sitemapIndexRes = await fetch(`${BASE_URL}/sitemap.xml`);
  const sitemapUrls = new Set<string>();
  if (sitemapIndexRes.status !== 200) {
    failures.push(`GET /sitemap.xml returned ${sitemapIndexRes.status}`);
  } else {
    const indexXml = await sitemapIndexRes.text();
    const segmentUrls = extractXmlLocs(indexXml);
    if (segmentUrls.length === 0) {
      failures.push("/sitemap.xml returned zero child sitemap segments");
    }

    for (const segmentUrl of segmentUrls) {
      const parsedSegment = new URL(segmentUrl, BASE_URL);
      const segRes = await fetch(`${BASE_URL}${parsedSegment.pathname}`);
      if (segRes.status !== 200) {
        failures.push(`Child sitemap ${parsedSegment.pathname} returned ${segRes.status}`);
        continue;
      }
      const segXml = await segRes.text();
      if (segXml.includes("<priority>") || segXml.includes("<changefreq>")) {
        failures.push(
          `Child sitemap ${parsedSegment.pathname} contains banned priority/changefreq`,
        );
      }
      for (const loc of extractXmlLocs(segXml)) {
        const path = normalizeInternalPath(loc);
        if (path) sitemapUrls.add(path);
      }
    }
  }

  // 3. BFS internal crawl starting at homepage
  const reachableFromHome = new Set<string>(["/"]);
  const bfsQueue: string[] = ["/"];
  const inspected = new Map<string, PageCheckResult>();

  while (bfsQueue.length > 0) {
    const currentPath = bfsQueue.shift()!;
    if (inspected.has(currentPath)) continue;
    const { check, discoveredPaths } = await inspectPage(currentPath);
    inspected.set(currentPath, check);
    for (const nextPath of discoveredPaths) {
      reachableFromHome.add(nextPath);
      if (!inspected.has(nextPath) && !bfsQueue.includes(nextPath)) {
        bfsQueue.push(nextPath);
      }
    }
  }

  // Ensure every sitemap URL was reachable from homepage (zero orphan pages)
  for (const sitemapPath of sitemapUrls) {
    if (!reachableFromHome.has(sitemapPath)) {
      failures.push(`Orphan sitemap URL not linked from homepage navigation tree: ${sitemapPath}`);
    }
    if (!inspected.has(sitemapPath)) {
      const { check } = await inspectPage(sitemapPath);
      inspected.set(sitemapPath, check);
    }
  }

  // Check page-level assertions & uniqueness of <title>
  const titlesSeen = new Map<string, string>();
  for (const [pathname, check] of inspected.entries()) {
    for (const err of check.errors) {
      failures.push(`${pathname}: ${err}`);
    }
    if (check.title) {
      const existing = titlesSeen.get(check.title);
      if (existing) {
        failures.push(`Duplicate <title> "${check.title}" on ${existing} and ${pathname}`);
      } else {
        titlesSeen.set(check.title, pathname);
      }
    }
  }

  console.log(
    `[seo:crawl] Checked ${inspected.size} pages (${sitemapUrls.size} sitemap URLs, ${reachableFromHome.size} internally linked URLs).`,
  );

  if (failures.length > 0) {
    console.error("[seo:crawl] Failures detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("[seo:crawl] All SEO, sitemap, JSON-LD, and internal-link checks passed.");
}

main().catch((err) => {
  console.error("[seo:crawl] Fatal error:", err);
  process.exit(1);
});
