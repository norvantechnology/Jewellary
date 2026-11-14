import { escapeXml } from "@/lib/seo/sitemap";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo/site";
import { SEO_TEMPLATE_TEXT, fillSeoText, stripMarkup } from "@/lib/seo/templates";

// Wording: data/frontend/site-content.json → site.seoTemplates.feed
const feedText = SEO_TEMPLATE_TEXT.feed;
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

export interface MerchantFeedProductInput {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  categoryPath: string;
  categoryBreadcrumb: string[];
  googleProductCategory: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  salePriceStartAt?: string | null;
  salePriceEndAt?: string | null;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  gtin: string | null;
  mpn: string | null;
  metalType: string | null;
  metalColor: string | null;
  stoneOrigin: string | null;
  caratTotal: string | null;
  certificationLab: string | null;
  isFeatured: boolean;
  images: Array<{ url: string; isPrimary: boolean }>;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    ringSize: string | null;
    metalOverride: string | null;
    priceDelta: string;
    stockOnHand: number;
    stockReserved: number;
    backorderable: boolean;
  }>;
}

export interface MerchantFeedOptions {
  country?: string;
  currency?: string;
  conversionRate?: number;
  decimals?: number;
  shippingZones?: ShippingZoneDTO[];
}

export function inferGoogleProductCategory(categoryPath: string, explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim();
  const lower = categoryPath.toLowerCase();
  if (lower.includes("ring")) return "Apparel & Accessories > Jewelry > Rings";
  if (lower.includes("earring") || lower.includes("stud"))
    return "Apparel & Accessories > Jewelry > Earrings";
  if (lower.includes("necklace") || lower.includes("pendant"))
    return "Apparel & Accessories > Jewelry > Necklaces";
  if (lower.includes("bracelet") || lower.includes("bangle"))
    return "Apparel & Accessories > Jewelry > Bracelets";
  return "Apparel & Accessories > Jewelry";
}

function formatMerchantPrice(
  baseAmount: number,
  currencyCode: string,
  rate = 1,
  decimals = 2,
): string {
  const converted = Math.max(0, baseAmount * rate);
  return `${converted.toFixed(decimals)} ${currencyCode.toUpperCase()}`;
}

function formatSaleDateWindow(start?: string | null, end?: string | null): string | null {
  const now = new Date();
  const s = start ? new Date(start) : now;
  const e = end ? new Date(end) : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return `${s.toISOString()}/${e.toISOString()}`;
}

export function buildMerchantFeedXml(
  products: MerchantFeedProductInput[],
  settings: PublicStoreSettings,
  options: MerchantFeedOptions = {},
): string {
  const siteUrl = getSiteUrl();
  const currency = (options.currency || settings.currency || "USD").toUpperCase();
  const country = (options.country || settings.defaultCountry || "US").toUpperCase();
  const rate =
    typeof options.conversionRate === "number" && options.conversionRate > 0
      ? options.conversionRate
      : 1;
  const decimals = options.decimals ?? (currency === "JPY" || currency === "KRW" ? 0 : 2);

  const activeZone =
    options.shippingZones?.find((z) => z.isActive && z.countries.includes(country)) ??
    options.shippingZones?.find((z) => z.isActive);

  const itemsXml: string[] = [];

  for (const product of products) {
    if (product.priceMode === "PRICE_ON_REQUEST") continue;
    const baseNum = Number(product.basePrice);
    if (!Number.isFinite(baseNum) || baseNum <= 0) continue;

    const validImages = product.images
      .filter((img) => Boolean(img.url) && !img.url.endsWith(".svg"))
      .map((img) => toAbsoluteUrl(img.url));
    if (validImages.length === 0) continue;

    const primaryImage = validImages[0]!;
    const additionalImages = validImages.slice(1, 10);
    const compareAtNum = product.compareAtPrice ? Number(product.compareAtPrice) : null;
    const hasSale =
      compareAtNum !== null && Number.isFinite(compareAtNum) && compareAtNum > baseNum;

    const gCategory = inferGoogleProductCategory(
      product.categoryPath,
      product.googleProductCategory,
    );
    const productType =
      product.categoryBreadcrumb.length > 0
        ? product.categoryBreadcrumb.join(" > ")
        : product.categoryPath;
    const caratNum = product.caratTotal ? Number(product.caratTotal) : 0;
    const caratBucket =
      caratNum >= 2
        ? "2ct+"
        : caratNum >= 1
          ? "1ct-2ct"
          : caratNum > 0
            ? "under-1ct"
            : "unspecified";
    const priceTier = baseNum >= 5000 ? "luxury" : baseNum >= 1500 ? "signature" : "essential";
    const originLabel = product.stoneOrigin || "Certified Diamond";

    const variants = product.variants.length > 0 ? product.variants : [null];
    const isGrouped = product.variants.length > 1;

    for (const variant of variants) {
      const itemId = variant ? variant.sku : product.sku;
      const delta = variant ? Number(variant.priceDelta) || 0 : 0;
      const finalBase = Math.max(1, baseNum + delta);
      const regularBase = hasSale ? Math.max(finalBase, compareAtNum! + delta) : finalBase;

      const availableUnits = variant ? Math.max(0, variant.stockOnHand - variant.stockReserved) : 0;
      const availability =
        availableUnits > 0 ? "in_stock" : variant?.backorderable ? "backorder" : "out_of_stock";

      const mpn = variant ? variant.sku : product.mpn || product.sku;
      const identifierExists = product.gtin || mpn ? "yes" : "no";
      const titleSuffix =
        variant && variant.title && variant.title.toLowerCase() !== "default"
          ? ` (${variant.title})`
          : "";
      const title = `${product.name}${titleSuffix}`.slice(0, 150);
      const description = stripMarkup(product.description || product.name).slice(0, 5000);
      const link = toAbsoluteUrl(`/products/${product.slug}`);
      const shippingFreeThreshold = activeZone?.freeThreshold
        ? Number(activeZone.freeThreshold)
        : settings.freeShippingThreshold
          ? Number(settings.freeShippingThreshold)
          : null;
      const shippingFlatRate = activeZone ? Number(activeZone.flatRate) : 0;
      const shippingCost =
        shippingFreeThreshold !== null && finalBase >= shippingFreeThreshold ? 0 : shippingFlatRate;

      const saleWindow = hasSale
        ? formatSaleDateWindow(product.salePriceStartAt, product.salePriceEndAt)
        : null;

      itemsXml.push(
        [
          "    <item>",
          `      <g:id>${escapeXml(itemId)}</g:id>`,
          ...(isGrouped
            ? [`      <g:item_group_id>${escapeXml(product.sku)}</g:item_group_id>`]
            : []),
          `      <g:title>${escapeXml(title)}</g:title>`,
          `      <g:description>${escapeXml(description)}</g:description>`,
          `      <g:link>${escapeXml(link)}</g:link>`,
          `      <g:image_link>${escapeXml(primaryImage)}</g:image_link>`,
          ...additionalImages.map(
            (img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`,
          ),
          `      <g:availability>${availability}</g:availability>`,
          `      <g:price>${escapeXml(formatMerchantPrice(regularBase, currency, rate, decimals))}</g:price>`,
          ...(hasSale
            ? [
                `      <g:sale_price>${escapeXml(formatMerchantPrice(finalBase, currency, rate, decimals))}</g:sale_price>`,
                ...(saleWindow
                  ? [
                      `      <g:sale_price_effective_date>${escapeXml(saleWindow)}</g:sale_price_effective_date>`,
                    ]
                  : []),
              ]
            : []),
          `      <g:brand>${escapeXml(settings.storeName)}</g:brand>`,
          "      <g:condition>new</g:condition>",
          ...(product.gtin ? [`      <g:gtin>${escapeXml(product.gtin)}</g:gtin>`] : []),
          ...(mpn ? [`      <g:mpn>${escapeXml(mpn)}</g:mpn>`] : []),
          `      <g:identifier_exists>${identifierExists}</g:identifier_exists>`,
          `      <g:google_product_category>${escapeXml(gCategory)}</g:google_product_category>`,
          `      <g:product_type>${escapeXml(productType)}</g:product_type>`,
          ...(variant?.metalOverride || product.metalType
            ? [
                `      <g:material>${escapeXml(variant?.metalOverride || product.metalType!)}</g:material>`,
              ]
            : []),
          ...(product.metalColor
            ? [`      <g:color>${escapeXml(product.metalColor)}</g:color>`]
            : []),
          ...(variant?.ringSize ? [`      <g:size>${escapeXml(variant.ringSize)}</g:size>`] : []),
          "      <g:shipping>",
          `        <g:country>${escapeXml(country)}</g:country>`,
          `        <g:service>${escapeXml(activeZone?.isInsured !== false ? feedText.insuredShipping : feedText.standardShipping)}</g:service>`,
          `        <g:price>${escapeXml(formatMerchantPrice(shippingCost, currency, rate, decimals))}</g:price>`,
          "      </g:shipping>",
          `      <g:custom_label_0>${product.isFeatured ? "featured" : "catalog"}</g:custom_label_0>`,
          `      <g:custom_label_1>${escapeXml(caratBucket)}</g:custom_label_1>`,
          `      <g:custom_label_2>${escapeXml(priceTier)}</g:custom_label_2>`,
          `      <g:custom_label_3>${escapeXml(product.certificationLab || "Uncertified")}</g:custom_label_3>`,
          `      <g:custom_label_4>${escapeXml(originLabel)}</g:custom_label_4>`,
          "    </item>",
        ].join("\n"),
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(settings.storeName)} — Google Merchant Center Product Feed</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(settings.tagline || feedText.channelDescription)}</description>`,
    itemsXml.join("\n"),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export interface GuideFeedArticleInput {
  slug: string;
  title: string;
  excerpt: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
  articleSection?: string | null;
  coverImageUrl?: string | null;
}

export function buildGuidesRssXml(
  articles: GuideFeedArticleInput[],
  settings: PublicStoreSettings,
): string {
  const siteUrl = getSiteUrl();
  const feedUrl = toAbsoluteUrl("/guides/feed.xml");

  const items = articles
    .map((article) => {
      const link = toAbsoluteUrl(`/guides/${article.slug}`);
      const pubDate = new Date(article.publishedAt || article.updatedAt).toUTCString();
      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <description>${escapeXml(stripMarkup(article.excerpt))}</description>`,
        ...(article.articleSection
          ? [`      <category>${escapeXml(article.articleSection)}</category>`]
          : []),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(fillSeoText(feedText.guidesTitle, { brand: settings.storeName }))}</title>`,
    `    <link>${escapeXml(toAbsoluteUrl("/guides"))}</link>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(fillSeoText(feedText.guidesDescription, { brand: settings.storeName }))}</description>`,
    `    <language>en-us</language>`,
    `    <copyright>© ${new Date().getFullYear()} ${escapeXml(settings.storeName)}</copyright>`,
    `    <docs>${escapeXml(siteUrl)}</docs>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
