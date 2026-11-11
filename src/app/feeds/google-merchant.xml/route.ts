import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { toAbsoluteUrl } from "@/lib/seo/metadata";
import { getMerchantFeedItems } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function tokensMatch(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Token-protected Google Merchant Center XML feed (`SEO-16`, `AI-11`).
 * Accepts `?token=<MERCHANT_FEED_TOKEN>` or `Authorization: Bearer <MERCHANT_FEED_TOKEN>`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const queryToken = request.nextUrl.searchParams.get("token")?.trim() ?? null;
  const supplied = bearerToken || queryToken;

  if (!tokensMatch(supplied, env.MERCHANT_FEED_TOKEN)) {
    return NextResponse.json({ error: "Valid merchant feed token required." }, { status: 401 });
  }

  const [settings, items] = await Promise.all([getPublicStoreSettings(), getMerchantFeedItems()]);
  const siteUrl = toAbsoluteUrl("/");

  const xmlItems = items
    .map((item) => {
      const link = toAbsoluteUrl(`/products/${item.slug}`);
      const imageLink = item.imageUrl
        ? toAbsoluteUrl(item.imageUrl)
        : toAbsoluteUrl("/opengraph-image");
      const additionalImagesXml = item.additionalImageUrls
        .map(
          (url) =>
            `<g:additional_image_link>${escapeXml(toAbsoluteUrl(url))}</g:additional_image_link>`,
        )
        .join("");

      const hasIdentifier = Boolean(item.gtin || item.mpn);
      const identifiersXml = [
        item.gtin ? `<g:gtin>${escapeXml(item.gtin)}</g:gtin>` : "",
        item.mpn ? `<g:mpn>${escapeXml(item.mpn)}</g:mpn>` : "",
        `<g:identifier_exists>${hasIdentifier ? "true" : "false"}</g:identifier_exists>`,
      ].join("");

      return [
        "<item>",
        `<g:id>${escapeXml(item.id)}</g:id>`,
        `<g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>`,
        `<g:title>${escapeXml(item.title)}</g:title>`,
        `<g:description>${escapeXml(item.description)}</g:description>`,
        `<g:link>${escapeXml(link)}</g:link>`,
        `<g:image_link>${escapeXml(imageLink)}</g:image_link>`,
        additionalImagesXml,
        `<g:availability>${item.availability}</g:availability>`,
        `<g:price>${Number(item.price).toFixed(2)} ${escapeXml(settings.currency)}</g:price>`,
        `<g:brand>${escapeXml(settings.storeName)}</g:brand>`,
        identifiersXml,
        `<g:condition>new</g:condition>`,
        `<g:google_product_category>${escapeXml(item.googleProductCategory)}</g:google_product_category>`,
        `<g:product_type>${escapeXml(item.productType)}</g:product_type>`,
        item.material ? `<g:material>${escapeXml(item.material)}</g:material>` : "",
        item.color ? `<g:color>${escapeXml(item.color)}</g:color>` : "",
        item.size ? `<g:size>${escapeXml(item.size)}</g:size>` : "",
        item.shippingWeightGrams
          ? `<g:shipping_weight>${escapeXml(item.shippingWeightGrams)} g</g:shipping_weight>`
          : "",
        "</item>",
      ].join("");
    })
    .join("\n");

  const rssXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">`,
    `<channel>`,
    `<title>${escapeXml(settings.storeName)} Product Catalogue</title>`,
    `<link>${escapeXml(siteUrl)}</link>`,
    `<description>${escapeXml(settings.tagline ?? "Certified diamonds and fine jewellery.")}</description>`,
    xmlItems,
    `</channel>`,
    `</rss>`,
  ].join("\n");

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
