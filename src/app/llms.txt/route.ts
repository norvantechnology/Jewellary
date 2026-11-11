import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toAbsoluteUrl } from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getAllActiveCategoriesTree } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

/**
 * Generates `/llms.txt` (`AI-14`, controlled by `ENABLE_LLMS_TXT`) summarizing key collections,
 * gemological buying guides, and store policies in markdown format for AI retrieval systems.
 */
export async function GET() {
  if (env.ENABLE_LLMS_TXT !== "true") {
    return new NextResponse("Not found", { status: 404 });
  }

  const [settings, categories, articles] = await Promise.all([
    getPublicStoreSettings(),
    getAllActiveCategoriesTree(),
    getPublishedArticles(),
  ]);

  const lines: string[] = [
    `# ${settings.storeName}`,
    "",
    `> ${settings.tagline ?? "Certified fine diamond jewellery crafted in recycled 18K gold and 950 platinum."}`,
    "",
    `Website: ${toAbsoluteUrl("/")}`,
    `Contact: ${settings.contactEmail}`,
    `Currency: ${settings.currency} · Insured Returns: ${settings.returnWindowDays} days`,
    "",
    "## Fine Jewellery Collections",
    ...categories.map(
      (cat) =>
        `- [${cat.name}](${toAbsoluteUrl(`/collections/${cat.path}`)}): ${cat.description ?? `${cat.name} crafted in 18K gold and platinum.`}`,
    ),
    "",
    "## Gemological Buying Guides",
    ...articles.map(
      (article) =>
        `- [${article.title}](${toAbsoluteUrl(`/guides/${article.slug}`)}): ${article.excerpt}`,
    ),
    "",
    "## Client Care & Policies",
    `- [All Jewellery Catalogue](${toAbsoluteUrl("/collections")}): Browse all filterable GIA and IGI certified pieces.`,
    `- [Shipping & Returns Policy](${toAbsoluteUrl("/shipping-returns")}): Insured courier delivery thresholds, adult signature requirements, and return eligibility.`,
    `- [Ring Size Guide](${toAbsoluteUrl("/ring-size-guide")}): US/UK/EU diameter and circumference sizing conversions.`,
    `- [Care Guide](${toAbsoluteUrl("/care-guide")}): Ultrasonic cleaning, prong inspection, and travel storage guidance.`,
    `- [Frequently Asked Questions](${toAbsoluteUrl("/faq")}): Diamond certification, custom lead times, and resizing answers.`,
    `- [About the Atelier](${toAbsoluteUrl("/about")}): Craft standards, provenance, and sourcing philosophy.`,
    `- [Private Concierge](${toAbsoluteUrl("/contact")}): Bespoke design consultation and stone sourcing enquiries.`,
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
