import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import dotenv from "dotenv";

function resolveMerchantFeedToken(): string {
  if (process.env.MERCHANT_FEED_TOKEN) return process.env.MERCHANT_FEED_TOKEN;
  const envPath = path.join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const parsed = dotenv.parse(readFileSync(envPath, "utf8"));
    if (parsed.MERCHANT_FEED_TOKEN) return parsed.MERCHANT_FEED_TOKEN;
  }
  return "dev_merchant_feed_token";
}

test.describe("Phase 7 E2E — Technical SEO, JSON-LD, Sitemaps, Feeds & AI Crawlers", () => {
  test("serves robots.txt, segmented sitemaps, llms.txt, OG images, and Merchant Center XML feed", async ({
    request,
  }) => {
    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robotsBody = await robotsRes.text();
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).toContain("OAI-SearchBot");
    expect(robotsBody).toContain("Disallow: /admin");
    expect(robotsBody).not.toContain("Disallow: /search");

    const sitemapIndexRes = await request.get("/sitemap.xml");
    expect(sitemapIndexRes.status()).toBe(200);
    const sitemapIndexXml = await sitemapIndexRes.text();
    expect(sitemapIndexXml).toContain("/sitemap/static.xml");
    expect(sitemapIndexXml).toContain("/sitemap/categories.xml");
    expect(sitemapIndexXml).toContain("/sitemap/products.xml");
    expect(sitemapIndexXml).toContain("/sitemap/guides.xml");

    for (const seg of ["static", "categories", "products", "guides"]) {
      const segRes = await request.get(`/sitemap/${seg}.xml`);
      expect(segRes.status()).toBe(200);
      const segXml = await segRes.text();
      expect(segXml).toContain("<urlset");
      expect(segXml).not.toContain("<priority>");
      expect(segXml).not.toContain("<changefreq>");
    }

    const llmsRes = await request.get("/llms.txt");
    expect(llmsRes.status()).toBe(200);
    const llmsText = await llmsRes.text();
    expect(llmsText).toContain("## Fine Jewellery Collections");

    const unauthFeed = await request.get("/feeds/google-merchant.xml");
    expect(unauthFeed.status()).toBe(401);

    const token = resolveMerchantFeedToken();
    const feedRes = await request.get(
      `/feeds/google-merchant.xml?token=${encodeURIComponent(token)}`,
    );
    expect(feedRes.status()).toBe(200);
    const feedXml = await feedRes.text();
    expect(feedXml).toContain("<rss");
    expect(feedXml).toContain("<g:price>");

    const rootOgRes = await request.get("/opengraph-image");
    expect(rootOgRes.status()).toBe(200);
    expect(rootOgRes.headers()["content-type"]).toContain("image/png");
  });

  test("renders canonical tags, robots rules, valid OG images, and JSON-LD graphs on key storefront pages", async ({
    page,
    request,
  }) => {
    async function extractJsonLdTypes(currentPath: string) {
      await page.goto(currentPath);
      await expect(page.locator("h1")).toHaveCount(1);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toBeTruthy();

      const ogImageHref = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(ogImageHref).toBeTruthy();
      if (ogImageHref) {
        const ogPath = new URL(ogImageHref).pathname;
        const ogRes = await request.get(ogPath);
        expect(ogRes.status()).toBe(200);
        expect(ogRes.headers()["content-type"]).toMatch(/^image\//);
      }

      const rawScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      const parsed = rawScripts.map((text) => JSON.parse(text) as { "@type"?: string });
      return parsed.map((obj) => obj["@type"]);
    }

    const homeTypes = await extractJsonLdTypes("/");
    expect(homeTypes).toEqual(expect.arrayContaining(["Organization", "WebSite"]));

    const collectionTypes = await extractJsonLdTypes("/collections/rings");
    expect(collectionTypes).toEqual(
      expect.arrayContaining(["Organization", "CollectionPage", "BreadcrumbList"]),
    );

    const pdpTypes = await extractJsonLdTypes("/products/celeste-cathedral-solitaire-ring");
    expect(pdpTypes.some((t) => t === "Product" || t === "ProductGroup")).toBe(true);
    expect(pdpTypes).toContain("BreadcrumbList");

    const guideTypes = await extractJsonLdTypes("/guides/understanding-diamond-4cs");
    expect(guideTypes).toEqual(expect.arrayContaining(["Article", "BreadcrumbList"]));

    const aboutTypes = await extractJsonLdTypes("/about");
    expect(aboutTypes).toContain("AboutPage");

    // Filtered collection canonicalizes to base path & emits noindex, follow
    await page.goto("/collections/rings?sort=price-asc");
    const filteredCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(filteredCanonical).toMatch(/\/collections\/rings$/);
    const filteredRobots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(filteredRobots).toContain("noindex");
    expect(filteredRobots).toContain("follow");

    // /search emits noindex, follow; /cart emits noindex, nofollow
    await page.goto("/search?q=gold");
    const searchRobots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(searchRobots).toContain("noindex");
    expect(searchRobots).toContain("follow");

    await page.goto("/cart");
    const cartRobots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(cartRobots).toContain("noindex");
    expect(cartRobots).toContain("nofollow");
  });
});
