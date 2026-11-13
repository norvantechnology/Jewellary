import { NextResponse } from "next/server";
import {
  SITEMAP_CHUNK_SIZE,
  createXmlResponseHeaders,
  renderSitemapIndexXml,
} from "@/lib/seo/sitemap";
import { getActiveIndexableProductCount } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function GET() {
  const [productCount, settings] = await Promise.all([
    getActiveIndexableProductCount(),
    getPublicStoreSettings(),
  ]);

  const productChunks = Math.max(1, Math.ceil(productCount / SITEMAP_CHUNK_SIZE));
  const lastMod = settings.updatedAt ?? new Date().toISOString();

  const entries = [
    { url: "/sitemaps/pages.xml", lastModified: lastMod },
    { url: "/sitemaps/collections.xml", lastModified: lastMod },
    { url: "/sitemaps/landing-facets.xml", lastModified: lastMod },
    { url: "/sitemaps/guides.xml", lastModified: lastMod },
    ...Array.from({ length: productChunks }, (_, idx) => ({
      url: `/sitemaps/products-${idx + 1}.xml`,
      lastModified: lastMod,
    })),
    ...Array.from({ length: productChunks }, (_, idx) => ({
      url: `/sitemaps/images-${idx + 1}.xml`,
      lastModified: lastMod,
    })),
  ];

  const xml = renderSitemapIndexXml(entries);
  return new NextResponse(xml, {
    status: 200,
    headers: createXmlResponseHeaders(),
  });
}
