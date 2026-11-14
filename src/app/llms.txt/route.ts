import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toAbsoluteUrl } from "@/lib/seo/metadata";
import { SEO_TEMPLATE_TEXT, fillSeoText } from "@/lib/seo/templates";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getAllActiveCategoriesTree } from "@/modules/catalog/catalog.public";
import { listSitemapLandingFacets } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

/**
 * Generates `/llms.txt` summarizing collections, curated landing facets, buying guides,
 * and store policies in clean markdown for AI retrieval systems.
 */
export async function GET() {
  if (env.ENABLE_LLMS_TXT !== "true") {
    return new NextResponse("Not found", { status: 404 });
  }

  const [settings, categories, facets, articles] = await Promise.all([
    getPublicStoreSettings(),
    getAllActiveCategoriesTree(),
    listSitemapLandingFacets().catch(() => []),
    getPublishedArticles(),
  ]);

  // Wording: data/frontend/site-content.json → site.seoTemplates.llms
  const text = SEO_TEMPLATE_TEXT.llms;
  const lines: string[] = [
    `# ${settings.storeName}`,
    "",
    `> ${settings.tagline ?? text.tagline}`,
    "",
    `Website: ${toAbsoluteUrl("/")}`,
    `Full Context Digest: ${toAbsoluteUrl("/llms-full.txt")}`,
    `Contact: ${settings.contactEmail}`,
    `Currency: ${settings.currency} · Returns: ${settings.returnWindowDays} days`,
    "",
    `## ${text.collectionsHeading}`,
    ...categories.map(
      (cat) =>
        `- [${cat.name}](${toAbsoluteUrl(`/collections/${cat.path}`)}): ${cat.description ?? fillSeoText(text.collectionFallback, { name: cat.name })}`,
    ),
    ...(facets.length > 0
      ? [
          "",
          `## ${text.specialtyHeading}`,
          ...facets.map(
            (facet) =>
              `- [${facet.facetSlug.replace(/-/g, " ")}](${toAbsoluteUrl(`/collections/${facet.categoryPath}/${facet.facetSlug}`)})`,
          ),
        ]
      : []),
    "",
    `## ${text.guidesHeading}`,
    ...articles
      .filter((a) => !a.noindex)
      .map(
        (article) =>
          `- [${article.title}](${toAbsoluteUrl(`/guides/${article.slug}`)}): ${article.excerpt}`,
      ),
    "",
    `## ${text.policiesHeading}`,
    ...text.links.map((link) => `- [${link.label}](${toAbsoluteUrl(link.href)}): ${link.text}`),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
