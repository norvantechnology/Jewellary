import { NextResponse } from "next/server";
import { getEditorialLastModified } from "@/lib/content";
import {
  SITEMAP_CHUNK_SIZE,
  createXmlResponseHeaders,
  renderSitemapIndexXml,
} from "@/lib/seo/sitemap";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getActiveIndexableProductCount,
  getSitemapCategories,
  getSitemapProducts,
} from "@/modules/catalog/catalog.public";
import { listSitemapLandingFacets } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

/** Latest date in a list (ISO string), or the fallback when the list is empty. */
function latest(dates: Array<Date | string | null | undefined>, fallback: string): string {
  let max = 0;
  for (const d of dates) {
    const t = d ? new Date(d).getTime() : 0;
    if (t > max) max = t;
  }
  return max > 0 ? new Date(max).toISOString() : fallback;
}

/**
 * /sitemap.xml (rewritten here): one entry per non-empty section, each with the real date its
 * content last changed so search engines re-crawl new products quickly. Product sitemaps already
 * include every product photo (<image:image>), so there is no separate image sitemap.
 */
export async function GET() {
  const [productCount, settings, categories, facets, guides, editorialDate] = await Promise.all([
    getActiveIndexableProductCount(),
    getPublicStoreSettings(),
    getSitemapCategories(),
    listSitemapLandingFacets(),
    getPublishedArticles(),
    getEditorialLastModified("about"),
  ]);
  const fallback = settings.updatedAt ?? new Date().toISOString();
  const productChunks = Math.max(1, Math.ceil(productCount / SITEMAP_CHUNK_SIZE));
  const productDates = await Promise.all(
    Array.from({ length: productChunks }, async (_, idx) => {
      const rows = await getSitemapProducts(idx * SITEMAP_CHUNK_SIZE, SITEMAP_CHUNK_SIZE);
      return latest(
        rows.map((r) => r.updatedAt),
        fallback,
      );
    }),
  );

  const entries = [
    {
      url: "/sitemaps/pages.xml",
      lastModified: latest([editorialDate, settings.updatedAt], fallback),
    },
    ...(categories.length > 0
      ? [
          {
            url: "/sitemaps/collections.xml",
            lastModified: latest(
              categories.map((c) => c.updatedAt),
              fallback,
            ),
          },
        ]
      : []),
    ...(facets.length > 0
      ? [
          {
            url: "/sitemaps/landing-facets.xml",
            lastModified: latest(
              facets.map((f) => f.updatedAt),
              fallback,
            ),
          },
        ]
      : []),
    ...(guides.length > 0
      ? [
          {
            url: "/sitemaps/guides.xml",
            lastModified: latest(
              guides.map((g) => g.updatedAt),
              fallback,
            ),
          },
        ]
      : []),
    ...(productCount > 0
      ? productDates.map((lastModified, idx) => ({
          url: `/sitemaps/products-${idx + 1}.xml`,
          lastModified,
        }))
      : []),
  ];

  const xml = renderSitemapIndexXml(entries);
  return new NextResponse(xml, {
    status: 200,
    headers: createXmlResponseHeaders(),
  });
}
