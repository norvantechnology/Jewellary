// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { GET as getMerchantFeed } from "@/app/feeds/google-merchant.xml/route";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { generateSitemaps, default as getSitemapSegment } from "@/app/sitemap";
import { GET as getSitemapIndex } from "@/app/sitemap-index.xml/route";
import { env } from "@/lib/env";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();

describe("Phase 7 Integration — Sitemaps, Merchant Feed, llms.txt, and Archived Redirects", () => {
  const uniqueSuffix = Date.now().toString(36);
  const createdProductIds: string[] = [];

  afterAll(async () => {
    for (const id of createdProductIds) {
      await db.product.deleteMany({ where: { id } });
    }
    await db.$disconnect();
  });

  it("generates segmented XML sitemap index and valid child segments without priority/changefreq (SEO-17)", async () => {
    const indexResponse = await getSitemapIndex();
    expect(indexResponse.status).toBe(200);
    const indexXml = await indexResponse.text();
    expect(indexXml).toContain("<sitemapindex");
    expect(indexXml).toContain("/sitemap/static.xml");
    expect(indexXml).toContain("/sitemap/categories.xml");
    expect(indexXml).toContain("/sitemap/products.xml");
    expect(indexXml).toContain("/sitemap/guides.xml");

    const segments = await generateSitemaps();
    expect(segments.map((s) => s.id)).toEqual(
      expect.arrayContaining(["static", "categories", "products", "guides"]),
    );

    const staticEntries = await getSitemapSegment({ id: Promise.resolve("static") });
    expect(staticEntries.some((entry) => entry.url.endsWith("/"))).toBe(true);
    expect(staticEntries.some((entry) => entry.url.endsWith("/shipping-returns"))).toBe(true);
    for (const entry of staticEntries) {
      expect("priority" in entry).toBe(false);
      expect("changeFrequency" in entry).toBe(false);
      expect(entry.lastModified).toBeInstanceOf(Date);
    }

    const productEntries = await getSitemapSegment({ id: Promise.resolve("products") });
    expect(productEntries.length).toBeGreaterThanOrEqual(5);
    expect(productEntries.some((entry) => (entry.images?.length ?? 0) > 0)).toBe(true);
  });

  it("enforces timing-safe token auth and emits Google Merchant Center RSS XML for FIXED active SKUs (SEO-16)", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/feeds/google-merchant.xml");
    const unauthRes = await getMerchantFeed(unauthReq);
    expect(unauthRes.status).toBe(401);

    const wrongReq = new NextRequest(
      "http://localhost:3000/feeds/google-merchant.xml?token=bad-token",
    );
    const wrongRes = await getMerchantFeed(wrongReq);
    expect(wrongRes.status).toBe(401);

    const authedReq = new NextRequest(
      `http://localhost:3000/feeds/google-merchant.xml?token=${encodeURIComponent(env.MERCHANT_FEED_TOKEN)}`,
    );
    const authedRes = await getMerchantFeed(authedReq);
    expect(authedRes.status).toBe(200);
    expect(authedRes.headers.get("content-type")).toContain("application/xml");

    const xml = await authedRes.text();
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<g:id>");
    expect(xml).toContain("<g:price>");
    expect(xml).toContain("<g:availability>");
    // Price-on-request Sovereign ring should NOT appear in Google Merchant feed
    expect(xml).not.toContain("sovereign-atelier-high-jewellery-cushion-ring");

    // Bearer header auth also succeeds
    const bearerReq = new NextRequest("http://localhost:3000/feeds/google-merchant.xml", {
      headers: { Authorization: `Bearer ${env.MERCHANT_FEED_TOKEN}` },
    });
    const bearerRes = await getMerchantFeed(bearerReq);
    expect(bearerRes.status).toBe(200);
  });

  it("renders markdown /llms.txt containing collections, guides, and policies (AI-14)", async () => {
    const res = await getLlmsTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");

    const markdown = await res.text();
    expect(markdown).toContain("## Fine Jewellery Collections");
    expect(markdown).toContain("## Gemological Buying Guides");
    expect(markdown).toContain("/collections/rings");
    expect(markdown).toContain("/shipping-returns");
  });

  it("returns redirect-category for archived products so visitors redirect to parent collection (SEO-11a)", async () => {
    const ringCategory = await db.category.findFirst({ where: { slug: "rings" } });
    expect(ringCategory).not.toBeNull();
    if (!ringCategory) return;

    const archivedProduct = await db.product.create({
      data: {
        sku: `ARCH-${uniqueSuffix}`,
        name: `Archived Ring ${uniqueSuffix}`,
        slug: `archived-ring-${uniqueSuffix}`,
        categoryId: ringCategory.id,
        status: "ARCHIVED",
        priceMode: "FIXED",
        basePrice: 1200,
      },
    });
    createdProductIds.push(archivedProduct.id);

    const resolution = await getPublicProductBySlug(archivedProduct.slug);
    expect(resolution).toEqual({
      kind: "redirect-category",
      categoryPath: ringCategory.path,
    });
  });
});
