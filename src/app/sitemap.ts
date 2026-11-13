import type { MetadataRoute } from "next";
import { getEditorialLastModified } from "@/lib/content";
import { toAbsoluteUrl } from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getActiveIndexableProductCount,
  getSitemapCategories,
  getSitemapProducts,
} from "@/modules/catalog/catalog.public";
import { listAllStaticPageSeos, listSitemapLandingFacets } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

const PRODUCTS_PER_SITEMAP = 50000;

export async function generateSitemaps() {
  const productCount = await getActiveIndexableProductCount();
  const productChunks = Math.max(1, Math.ceil(productCount / PRODUCTS_PER_SITEMAP));

  const segments: Array<{ id: string }> = [
    { id: "static" },
    { id: "categories" },
    { id: "landing-facets" },
    ...Array.from({ length: productChunks }, (_, idx) => ({
      id: idx === 0 ? "products" : `products-${idx}`,
    })),
    { id: "guides" },
  ];

  return segments;
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "static") {
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

    const noindexSet = new Set(staticOverrides.filter((s) => s.noindex).map((s) => s.slug));
    const siteUpdated = new Date(settings.updatedAt ?? aboutMtime);

    const staticCandidates = [
      { slug: "/", lastModified: siteUpdated },
      { slug: "/collections", lastModified: siteUpdated },
      { slug: "/guides", lastModified: siteUpdated },
      { slug: "/contact", lastModified: siteUpdated },
      { slug: "/about", lastModified: new Date(aboutMtime) },
      { slug: "/faq", lastModified: new Date(faqMtime) },
      { slug: "/shipping-returns", lastModified: new Date(shippingMtime) },
      { slug: "/ring-size-guide", lastModified: new Date(ringSizeMtime) },
      { slug: "/care-guide", lastModified: new Date(careMtime) },
      { slug: "/privacy", lastModified: new Date(privacyMtime) },
      { slug: "/terms", lastModified: new Date(termsMtime) },
    ];

    return staticCandidates
      .filter((entry) => !noindexSet.has(entry.slug))
      .map((entry) => ({
        url: toAbsoluteUrl(entry.slug),
        lastModified: entry.lastModified,
      }));
  }

  if (id === "categories") {
    const categories = await getSitemapCategories();
    return categories.map((cat) => ({
      url: toAbsoluteUrl(`/collections/${cat.path}`),
      lastModified: cat.updatedAt,
      ...(cat.imageUrl ? { images: [toAbsoluteUrl(cat.imageUrl)] } : {}),
    }));
  }

  if (id === "landing-facets") {
    const facets = await listSitemapLandingFacets();
    return facets.map((facet) => ({
      url: toAbsoluteUrl(`/collections/${facet.categoryPath}/${facet.facetSlug}`),
      lastModified: facet.updatedAt,
    }));
  }

  if (id === "products" || id.startsWith("products-")) {
    const chunkIndex =
      id === "products" ? 0 : Math.max(0, Number(id.replace("products-", "")) || 0);
    const products = await getSitemapProducts(
      chunkIndex * PRODUCTS_PER_SITEMAP,
      PRODUCTS_PER_SITEMAP,
    );
    return products.map((product) => ({
      url: toAbsoluteUrl(`/products/${product.slug}`),
      lastModified: product.updatedAt,
      ...(product.images.length > 0
        ? { images: product.images.map((url) => toAbsoluteUrl(url)) }
        : {}),
    }));
  }

  if (id === "guides") {
    const articles = await getPublishedArticles();
    return articles
      .filter((article) => !article.noindex)
      .map((article) => ({
        url: toAbsoluteUrl(`/guides/${article.slug}`),
        lastModified: new Date(article.updatedAt),
        ...(article.coverImageUrl ? { images: [toAbsoluteUrl(article.coverImageUrl)] } : {}),
      }));
  }

  return [];
}
