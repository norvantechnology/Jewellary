import { NextResponse } from "next/server";
import { getEditorialLastModified } from "@/lib/content";
import { SITEMAP_CHUNK_SIZE, createXmlResponseHeaders, renderUrlSetXml } from "@/lib/seo/sitemap";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getHomepagePayload,
  getSitemapCategories,
  getSitemapProducts,
} from "@/modules/catalog/catalog.public";
import { listAllStaticPageSeos, listSitemapLandingFacets } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface SitemapsSegmentContext {
  params: Promise<{ segment: string }>;
}

export async function GET(_request: Request, { params }: SitemapsSegmentContext) {
  const { segment: rawSegment } = await params;
  const segment = rawSegment.endsWith(".xml") ? rawSegment.slice(0, -4) : rawSegment;

  if (segment === "pages") {
    const [
      settings,
      staticOverrides,
      aboutMtime,
      faqMtime,
      shippingMtime,
      ringSizeMtime,
      careMtime,
      privacyMtime,
      termsMtime,
    ] = await Promise.all([
      getPublicStoreSettings(),
      listAllStaticPageSeos().catch(() => []),
      getEditorialLastModified("about"),
      getEditorialLastModified("faq"),
      getEditorialLastModified("shipping-returns"),
      getEditorialLastModified("ring-size-guide"),
      getEditorialLastModified("care-guide"),
      getEditorialLastModified("privacy"),
      getEditorialLastModified("terms"),
    ]);

    // Home page images (banner, featured pieces, categories) so Google can show them for the site.
    const home = await getHomepagePayload().catch(() => null);
    const homeImages = home
      ? Array.from(
          new Set(
            [
              ...home.banners.hero.flatMap((b) => [b.imageUrl, b.mobileImageUrl]),
              ...[...home.featuredProducts, ...home.newArrivals, ...home.bestsellers].map(
                (p) => p.primaryImage?.url,
              ),
              ...home.categories.map((c) => c.imageUrl),
              ...home.banners.editorial.map((b) => b.imageUrl),
            ].filter((u): u is string => !!u),
          ),
        ).slice(0, 1000)
      : [];

    const noindexSet = new Set(staticOverrides.filter((s) => s.noindex).map((s) => s.slug));
    const siteUpdated = new Date(settings.updatedAt ?? aboutMtime);

    const candidates = [
      { url: "/", lastModified: siteUpdated, images: homeImages },
      { url: "/collections", lastModified: siteUpdated },
      { url: "/guides", lastModified: siteUpdated },
      { url: "/contact", lastModified: siteUpdated },
      { url: "/about", lastModified: new Date(aboutMtime) },
      { url: "/faq", lastModified: new Date(faqMtime) },
      { url: "/shipping-returns", lastModified: new Date(shippingMtime) },
      { url: "/ring-size-guide", lastModified: new Date(ringSizeMtime) },
      { url: "/care-guide", lastModified: new Date(careMtime) },
      { url: "/privacy", lastModified: new Date(privacyMtime) },
      { url: "/terms", lastModified: new Date(termsMtime) },
    ].filter((entry) => !noindexSet.has(entry.url));

    return new NextResponse(renderUrlSetXml(candidates), {
      status: 200,
      headers: createXmlResponseHeaders(),
    });
  }

  if (segment === "collections") {
    const categories = await getSitemapCategories();
    const xml = renderUrlSetXml(
      categories.map((cat) => ({
        url: `/collections/${cat.path}`,
        lastModified: cat.updatedAt,
        ...(cat.imageUrl ? { images: [cat.imageUrl] } : {}),
      })),
    );
    return new NextResponse(xml, { status: 200, headers: createXmlResponseHeaders() });
  }

  if (segment === "landing-facets") {
    const facets = await listSitemapLandingFacets();
    const xml = renderUrlSetXml(
      facets.map((facet) => ({
        url: `/collections/${facet.categoryPath}/${facet.facetSlug}`,
        lastModified: facet.updatedAt,
      })),
    );
    return new NextResponse(xml, { status: 200, headers: createXmlResponseHeaders() });
  }

  if (segment === "guides") {
    const articles = await getPublishedArticles();
    const xml = renderUrlSetXml(
      articles
        .filter((article) => !article.noindex)
        .map((article) => ({
          url: `/guides/${article.slug}`,
          lastModified: article.updatedAt,
          ...(article.coverImageUrl ? { images: [article.coverImageUrl] } : {}),
        })),
    );
    return new NextResponse(xml, { status: 200, headers: createXmlResponseHeaders() });
  }

  const productMatch = /^products-(\d+)$/.exec(segment);
  if (productMatch) {
    const pageNum = Math.max(1, Number(productMatch[1]) || 1);
    const skip = (pageNum - 1) * SITEMAP_CHUNK_SIZE;
    const products = await getSitemapProducts(skip, SITEMAP_CHUNK_SIZE);
    const xml = renderUrlSetXml(
      products.map((product) => ({
        url: `/products/${product.slug}`,
        lastModified: product.updatedAt,
        images: product.images,
      })),
    );
    return new NextResponse(xml, { status: 200, headers: createXmlResponseHeaders() });
  }

  const imageMatch = /^images-(\d+)$/.exec(segment);
  if (imageMatch) {
    const pageNum = Math.max(1, Number(imageMatch[1]) || 1);
    const skip = (pageNum - 1) * SITEMAP_CHUNK_SIZE;
    const products = await getSitemapProducts(skip, SITEMAP_CHUNK_SIZE);
    const xml = renderUrlSetXml(
      products
        .filter((p) => p.images.length > 0)
        .map((product) => ({
          url: `/products/${product.slug}`,
          lastModified: product.updatedAt,
          images: product.images,
        })),
      true,
    );
    return new NextResponse(xml, { status: 200, headers: createXmlResponseHeaders() });
  }

  return new NextResponse("Sitemap not found", { status: 404 });
}
