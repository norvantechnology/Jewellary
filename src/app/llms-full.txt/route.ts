import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { toAbsoluteUrl } from "@/lib/seo/site";
import { getPublishedArticles } from "@/modules/articles/article.service";
import {
  getAllActiveCategoriesTree,
  getMerchantFeedProductsForXml,
} from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function GET() {
  if (env.ENABLE_LLMS_TXT !== "true") {
    return new NextResponse("Not found", { status: 404 });
  }

  const [settings, categories, products, articles] = await Promise.all([
    getPublicStoreSettings(),
    getAllActiveCategoriesTree(),
    getMerchantFeedProductsForXml(),
    getPublishedArticles(),
  ]);

  const lines: string[] = [
    `# ${settings.storeName} — Complete Catalogue & Gemological Digest`,
    "",
    `Canonical Origin: ${toAbsoluteUrl("/")}`,
    `Legal Entity: ${settings.legalName ?? settings.storeName}`,
    `Contact: ${settings.contactEmail}`,
    `Base Currency: ${settings.currency} · Return Window: ${settings.returnWindowDays} days`,
    "",
    "## Collections Overview",
    ...categories.map(
      (cat) =>
        `### ${cat.name} (${toAbsoluteUrl(`/collections/${cat.path}`)})\n${cat.description ?? "Handcrafted fine diamond and gold jewellery."}`,
    ),
    "",
    "## Signature Certified Creations",
    ...products.slice(0, 100).map((p) => {
      const priceStr =
        p.priceMode === "PRICE_ON_REQUEST"
          ? "Price upon request"
          : formatMoney(Number(p.basePrice), settings.currency);
      const specs = [
        p.metalType,
        p.caratTotal ? `${p.caratTotal}ct` : null,
        p.certificationLab ? `${p.certificationLab} certified` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- **${p.name}** (${priceStr}) — ${specs || "Fine Jewellery"}. URL: ${toAbsoluteUrl(`/products/${p.slug}`)}`;
    }),
    "",
    "## Gemological Education & Guides",
    ...articles
      .filter((a) => !a.noindex)
      .map(
        (article) =>
          `### ${article.title}\nURL: ${toAbsoluteUrl(`/guides/${article.slug}`)}\nAuthor: ${article.authorName}${article.authorCredentials ? ` (${article.authorCredentials})` : ""}\nSummary: ${article.excerpt}`,
      ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
