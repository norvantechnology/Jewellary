import type {
  Article,
  BreadcrumbList,
  CollectionPage,
  FAQPage,
  ImageObject,
  ItemList,
  JewelryStore,
  MerchantReturnPolicy,
  Offer,
  OfferShippingDetails,
  Organization,
  Person,
  Product,
  ProductGroup,
  PropertyValue,
  WebPage,
  WebSite,
  WithContext,
} from "schema-dts";
import { inferGoogleProductCategory } from "@/lib/seo/feeds";
import { isDecorativePlaceholderUrl } from "@/lib/seo/images";
import { DEFAULT_LEGAL_NAME, getSiteUrl, toAbsoluteUrl } from "@/lib/seo/site";
import { SEO_TEMPLATE_TEXT, fillSeoText, stripMarkup } from "@/lib/seo/templates";
import type { PublicProductDetailDTO } from "@/modules/catalog/catalog.public";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

export function buildReturnPolicySchema(settings: PublicStoreSettings): MerchantReturnPolicy {
  const days = Math.max(0, settings.returnWindowDays);
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: settings.supportedCountries,
    returnPolicyCategory:
      days > 0
        ? "https://schema.org/MerchantReturnFiniteReturnWindow"
        : "https://schema.org/MerchantReturnNotPermitted",
    ...(days > 0 ? { merchantReturnDays: days } : {}),
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
    returnPolicyCountry: settings.defaultCountry,
    url: toAbsoluteUrl("/shipping-returns"),
  };
}

export function buildShippingDetailsSchema(
  settings: PublicStoreSettings,
  zoneOrZones?: ShippingZoneDTO | ShippingZoneDTO[] | null,
): OfferShippingDetails[] {
  const zones = Array.isArray(zoneOrZones)
    ? zoneOrZones.filter((z) => z.isActive)
    : zoneOrZones
      ? [zoneOrZones]
      : [];

  if (zones.length === 0) {
    return [
      {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: 0,
          currency: settings.currency,
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: settings.defaultCountry,
        },
      },
    ];
  }

  return zones.map((zone) => ({
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: Number(zone.flatRate),
      currency: settings.currency,
    },
    shippingDestination: zone.countries.map((countryCode) => ({
      "@type": "DefinedRegion",
      addressCountry: countryCode,
    })),
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 3,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: zone.estimatedDaysMin,
        maxValue: zone.estimatedDaysMax,
        unitCode: "DAY",
      },
    },
  }));
}

export function buildOrganizationJsonLd(
  settings: PublicStoreSettings,
  options?: { shippingZones?: ShippingZoneDTO[]; includeShippingPolicy?: boolean },
): WithContext<Organization> {
  const siteUrl = getSiteUrl();
  const rawLogoUrl = settings.logoUrl ?? "/icon-512.png";
  const logoUrl = toAbsoluteUrl(rawLogoUrl.endsWith(".svg") ? "/icon-512.png" : rawLogoUrl);
  const socialLinks = settings.socialLinks.map((link) => link.href).filter(Boolean);
  const storeAddress =
    settings.physicalStore?.streetAddress && settings.physicalStore?.city
      ? {
          "@type": "PostalAddress" as const,
          streetAddress: settings.physicalStore.streetAddress,
          addressLocality: settings.physicalStore.city,
          ...(settings.physicalStore.state ? { addressRegion: settings.physicalStore.state } : {}),
          ...(settings.physicalStore.postalCode
            ? { postalCode: settings.physicalStore.postalCode }
            : {}),
          ...(settings.physicalStore.country
            ? { addressCountry: settings.physicalStore.country }
            : {}),
        }
      : undefined;

  const shippingDetails =
    options?.includeShippingPolicy && options.shippingZones
      ? buildShippingDetailsSchema(settings, options.shippingZones)
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: settings.storeName,
    legalName:
      settings.legalName?.trim() ||
      fillSeoText(SEO_TEMPLATE_TEXT.fallbacks.legalName, { brand: settings.storeName }) ||
      DEFAULT_LEGAL_NAME,
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
      width: 512,
      height: 512,
    },
    ...(settings.tagline ? { description: settings.tagline } : {}),
    ...(socialLinks.length > 0 ? { sameAs: socialLinks } : {}),
    ...(storeAddress ? { address: storeAddress } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: settings.contactEmail,
        ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
        areaServed: settings.supportedCountries,
        availableLanguage: ["English"],
      },
    ],
    hasMerchantReturnPolicy: buildReturnPolicySchema(settings),
    ...(shippingDetails ? { hasShippingService: shippingDetails } : {}),
  } as unknown as WithContext<Organization>;
}

/**
 * Site Names WebSite schema. Intentionally omits retired SearchAction sitelinks-searchbox markup.
 */
export function buildWebSiteJsonLd(settings: PublicStoreSettings): WithContext<WebSite> {
  const siteUrl = getSiteUrl();
  const alternateName = Array.from(
    new Set(
      [settings.legalName?.trim(), "Shinora", "Shinora Jewelry"].filter(
        (v): v is string => Boolean(v) && v !== settings.storeName,
      ),
    ),
  );

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: settings.storeName,
    ...(alternateName.length > 0 ? { alternateName } : {}),
    url: `${siteUrl}/`,
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
  };
}

export function buildJewelryStoreJsonLd(
  settings: PublicStoreSettings,
): WithContext<JewelryStore> | null {
  const store = settings.physicalStore;
  if (!store || !store.streetAddress || !store.city || !store.country) {
    return null;
  }

  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    "@id": `${siteUrl}/#store`,
    name: store.name || settings.storeName,
    url: siteUrl,
    ...(settings.logoUrl ? { image: toAbsoluteUrl(settings.logoUrl) } : {}),
    ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
    email: settings.contactEmail,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.streetAddress,
      addressLocality: store.city,
      ...(store.state ? { addressRegion: store.state } : {}),
      ...(store.postalCode ? { postalCode: store.postalCode } : {}),
      addressCountry: store.country,
    },
    ...(store.hours ? { openingHours: store.hours } : {}),
    priceRange: "$$$",
    parentOrganization: { "@id": `${siteUrl}/#organization` },
  };
}

export function buildBreadcrumbListJsonLd(
  items: Array<{ name: string; path: string }>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}

export function buildCollectionJsonLd(input: {
  name: string;
  description: string;
  path: string;
  products: Array<{
    name: string;
    slug: string;
    primaryImageUrl?: string | null;
    primaryImage?: { url: string } | null;
    basePrice: string;
    priceMode: "FIXED" | "PRICE_ON_REQUEST";
    availableStock?: number;
    totalAvailableStock?: number;
  }>;
  currency: string;
  image?: string | null;
}): WithContext<CollectionPage> {
  const listItems: ItemList = {
    "@type": "ItemList",
    numberOfItems: input.products.length,
    itemListElement: input.products.slice(0, 24).map((prod, idx) => {
      const imgUrl = prod.primaryImage?.url ?? prod.primaryImageUrl ?? null;
      return {
        "@type": "ListItem",
        position: idx + 1,
        url: toAbsoluteUrl(`/products/${prod.slug}`),
        name: prod.name,
        ...(imgUrl && !isDecorativePlaceholderUrl(imgUrl) ? { image: toAbsoluteUrl(imgUrl) } : {}),
      };
    }),
  };

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: stripMarkup(input.description),
    url: toAbsoluteUrl(input.path),
    ...(input.image ? { image: toAbsoluteUrl(input.image) } : {}),
    mainEntity: listItems,
  };
}

function buildProductAdditionalProperties(product: PublicProductDetailDTO): PropertyValue[] {
  const specs: Array<[string, string | null | undefined]> = [
    ["Metal Type", product.metalType],
    ["Metal Purity", product.metalPurity],
    ["Metal Color", product.metalColor],
    ["Diamond Origin", product.stoneOrigin],
    ["Stone Shape", product.stoneShape],
    ["Total Carat Weight", product.caratTotal ? `${product.caratTotal} ct` : null],
    ["Center Stone Carat", product.caratCenter ? `${product.caratCenter} ct` : null],
    ["Color Grade", product.colorGrade],
    ["Clarity Grade", product.clarityGrade],
    ["Cut Grade", product.cutGrade],
    ["Polish Grade", product.polishGrade],
    ["Symmetry Grade", product.symmetryGrade],
    ["Fluorescence", product.fluorescence],
    ["Certification Laboratory", product.certificationLab],
    ["Certificate Number", product.certificateNumber],
  ];

  return specs
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value,
    }));
}

function buildProductImagesForSchema(product: PublicProductDetailDTO): string[] {
  const urls = new Set<string>();
  for (const img of product.images) {
    if (isDecorativePlaceholderUrl(img.url)) continue;
    urls.add(toAbsoluteUrl(img.url));
    if (img.responsiveVariants?.crops) {
      for (const cropUrl of Object.values(img.responsiveVariants.crops)) {
        if (cropUrl && !isDecorativePlaceholderUrl(cropUrl)) {
          urls.add(toAbsoluteUrl(cropUrl));
        }
      }
    }
  }
  return Array.from(urls);
}

function buildDefaultPriceValidUntil(saleEndAt?: string | null): string {
  if (saleEndAt) {
    const parsed = new Date(saleEndAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  // Deterministic fallback date so Next.js 16 cacheComponents prerendering stays pure.
  return "2027-12-31";
}

export function buildProductJsonLd(input: {
  product: PublicProductDetailDTO;
  settings: PublicStoreSettings;
  defaultShippingZone?: ShippingZoneDTO | null;
  shippingZones?: ShippingZoneDTO[];
}): WithContext<ProductGroup | Product> {
  const { product, settings } = input;
  const siteUrl = getSiteUrl();
  const productUrl = toAbsoluteUrl(`/products/${product.slug}`);
  const images = buildProductImagesForSchema(product);
  const additionalProperty = buildProductAdditionalProperties(product);
  const categoryName = inferGoogleProductCategory(
    product.categoryPath,
    product.googleProductCategory,
  );
  const plainDescription = stripMarkup(product.description || product.subtitle || product.name);
  const priceValidUntil = buildDefaultPriceValidUntil(product.salePriceEndAt);

  const zoneSource =
    input.shippingZones && input.shippingZones.length > 0
      ? input.shippingZones
      : input.defaultShippingZone
        ? [input.defaultShippingZone]
        : null;
  const shippingDetails = zoneSource ? buildShippingDetailsSchema(settings, zoneSource) : undefined;

  const makeOffer = (variant?: PublicProductDetailDTO["variants"][number]): Offer | undefined => {
    if (product.priceMode === "PRICE_ON_REQUEST") {
      return undefined;
    }
    const finalPriceNum = Number(variant?.price ?? product.basePrice);
    if (!Number.isFinite(finalPriceNum) || finalPriceNum <= 0) {
      return undefined;
    }
    const compareAtRaw = variant?.compareAtPrice ?? product.compareAtPrice;
    const compareAtNum = compareAtRaw ? Number(compareAtRaw) : null;
    const hasSale =
      compareAtNum !== null && Number.isFinite(compareAtNum) && compareAtNum > finalPriceNum;

    const available = variant ? variant.availableStock : product.totalAvailableStock;
    const availability =
      available > 0
        ? "https://schema.org/InStock"
        : product.leadTimeDays && product.leadTimeDays > 0
          ? "https://schema.org/PreOrder"
          : "https://schema.org/OutOfStock";

    const priceSpecification = hasSale
      ? [
          {
            "@type": "UnitPriceSpecification" as const,
            price: Number(compareAtNum!.toFixed(2)),
            priceCurrency: settings.currency,
            priceType: "https://schema.org/StrikethroughPrice" as const,
            ...(product.salePriceStartAt ? { validFrom: product.salePriceStartAt } : {}),
            ...(product.salePriceEndAt ? { validThrough: product.salePriceEndAt } : {}),
          },
          {
            "@type": "UnitPriceSpecification" as const,
            price: Number(finalPriceNum.toFixed(2)),
            priceCurrency: settings.currency,
            priceType: "https://schema.org/SalePrice" as const,
            validThrough: priceValidUntil,
          },
        ]
      : undefined;

    return {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: settings.currency,
      price: Number(finalPriceNum.toFixed(2)),
      priceValidUntil,
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: settings.storeName,
      },
      ...(priceSpecification ? { priceSpecification } : {}),
      ...(shippingDetails ? { shippingDetails } : {}),
    } as Offer;
  };

  if (product.variants.length > 1) {
    const hasSizes = product.variants.some((v) => Boolean(v.size));
    const hasMetals = product.variants.some((v) => Boolean(v.metal));
    const variesBy = [
      ...(hasSizes ? ["https://schema.org/size"] : []),
      ...(hasMetals ? ["https://schema.org/material"] : []),
    ];
    if (variesBy.length === 0) {
      variesBy.push("https://schema.org/size");
    }

    const group: WithContext<ProductGroup> = {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      "@id": `${productUrl}#product-group`,
      name: product.name,
      description: plainDescription,
      url: productUrl,
      productGroupID: product.sku,
      brand: {
        "@type": "Brand",
        name: settings.storeName,
      },
      category: categoryName,
      ...(images.length > 0 ? { image: images } : {}),
      ...(product.metalType ? { material: product.metalType } : {}),
      ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
      variesBy,
      hasVariant: product.variants.map((variant) => {
        const offer = makeOffer(variant);
        return {
          "@type": "Product",
          "@id": `${productUrl}#variant-${variant.sku}`,
          name: `${product.name} — ${variant.title}`,
          description: plainDescription,
          sku: variant.sku,
          mpn: variant.sku,
          inProductGroupWithID: product.sku,
          ...(product.gtin ? { gtin: product.gtin } : {}),
          ...(images.length > 0 ? { image: images } : {}),
          itemCondition: "https://schema.org/NewCondition",
          ...(variant.metal || product.metalType
            ? { material: variant.metal ?? product.metalType! }
            : {}),
          ...(product.metalColor ? { color: product.metalColor } : {}),
          ...(variant.size ? { size: variant.size } : {}),
          ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
          ...(offer ? { offers: offer } : {}),
        } as Product;
      }),
    };

    return group;
  }

  const singleVariant = product.variants[0];
  const singleOffer = makeOffer(singleVariant);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: plainDescription,
    url: productUrl,
    sku: singleVariant?.sku ?? product.sku,
    mpn: product.mpn ?? singleVariant?.sku ?? product.sku,
    ...(product.gtin ? { gtin: product.gtin } : {}),
    itemCondition: "https://schema.org/NewCondition",
    brand: {
      "@type": "Brand",
      name: settings.storeName,
    },
    category: categoryName,
    ...(images.length > 0 ? { image: images } : {}),
    ...(singleVariant?.metal || product.metalType
      ? { material: singleVariant?.metal ?? product.metalType! }
      : {}),
    ...(product.metalColor ? { color: product.metalColor } : {}),
    ...(singleVariant?.size ? { size: singleVariant.size } : {}),
    ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
    ...(singleOffer ? { offers: singleOffer } : {}),
  };
}

export function buildArticleJsonLd(input: {
  article: {
    title: string;
    slug: string;
    excerpt: string;
    coverImageUrl: string | null;
    authorName: string;
    authorJobTitle?: string | null;
    authorCredentials?: string | null;
    authorBio?: string | null;
    authorSameAs?: string[] | null;
    articleSection?: string | null;
    seoKeywords?: string | null;
    publishedAt: string | null;
    updatedAt: string;
  };
  settings: PublicStoreSettings;
}): WithContext<Article> {
  const siteUrl = getSiteUrl();
  const articleUrl = toAbsoluteUrl(`/guides/${input.article.slug}`);
  const coverUrl =
    input.article.coverImageUrl && !isDecorativePlaceholderUrl(input.article.coverImageUrl)
      ? toAbsoluteUrl(input.article.coverImageUrl)
      : toAbsoluteUrl(`/api/og/guide/${encodeURIComponent(input.article.slug)}`);

  const author: Person = {
    "@type": "Person",
    name: input.article.authorName,
    ...(input.article.authorJobTitle ? { jobTitle: input.article.authorJobTitle } : {}),
    ...(input.article.authorCredentials ? { hasCredential: input.article.authorCredentials } : {}),
    ...(input.article.authorBio ? { description: input.article.authorBio } : {}),
    ...(input.article.authorSameAs && input.article.authorSameAs.length > 0
      ? { sameAs: input.article.authorSameAs }
      : {}),
    worksFor: { "@id": `${siteUrl}/#organization` },
  } as Person;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.article.title,
    description: stripMarkup(input.article.excerpt),
    url: articleUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    image: [coverUrl],
    datePublished: input.article.publishedAt ?? input.article.updatedAt,
    dateModified: input.article.updatedAt,
    author,
    ...(input.article.articleSection ? { articleSection: input.article.articleSection } : {}),
    ...(input.article.seoKeywords ? { keywords: input.article.seoKeywords } : {}),
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: input.settings.storeName,
      ...(input.settings.logoUrl ? { logo: toAbsoluteUrl(input.settings.logoUrl) } : {}),
    },
  };
}

export function buildWebPageJsonLd(input: {
  type?: "WebPage" | "AboutPage" | "ContactPage" | "FAQPage";
  name: string;
  description: string;
  path: string;
  settings: PublicStoreSettings;
}): WithContext<WebPage> {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    name: input.name,
    description: stripMarkup(input.description),
    url: toAbsoluteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: input.settings.storeName,
      url: `${siteUrl}/`,
    },
  };
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> | null {
  const validFaqs = faqs
    .map((item) => ({
      question: stripMarkup(item.question),
      answer: stripMarkup(item.answer),
    }))
    .filter((item) => item.question.length >= 5 && item.answer.length >= 5);

  if (validFaqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildImageObjectsJsonLd(input: {
  images: Array<{
    url: string;
    altText: string;
    title?: string | null;
    caption?: string | null;
    creditText?: string | null;
    copyrightNotice?: string | null;
    licenseUrl?: string | null;
    width?: number;
    height?: number;
  }>;
  settings: PublicStoreSettings;
  acquireLicensePage?: string;
}): WithContext<ImageObject>[] {
  const siteUrl = getSiteUrl();
  return input.images
    .filter((img) => !isDecorativePlaceholderUrl(img.url))
    .map((img) => ({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      contentUrl: toAbsoluteUrl(img.url),
      name: img.title?.trim() || img.altText,
      caption: img.caption?.trim() || img.altText,
      description: img.altText,
      ...(img.width ? { width: img.width } : {}),
      ...(img.height ? { height: img.height } : {}),
      creator: {
        "@type": "Organization",
        name: input.settings.storeName,
        url: siteUrl,
      },
      creditText: img.creditText?.trim() || input.settings.storeName,
      copyrightNotice: img.copyrightNotice?.trim() || `© 2026 ${input.settings.storeName}`,
      license: img.licenseUrl?.trim() || toAbsoluteUrl("/terms"),
      acquireLicensePage: toAbsoluteUrl(input.acquireLicensePage || "/contact"),
    })) as unknown as WithContext<ImageObject>[];
}

export interface JsonLdValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateJsonLdNode(node: unknown): JsonLdValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!node || typeof node !== "object") {
    return { valid: false, errors: ["JSON-LD payload must be an object."], warnings };
  }

  const record = node as Record<string, unknown>;
  if (record["@context"] !== "https://schema.org") {
    errors.push(`Missing or invalid @context: ${String(record["@context"])}`);
  }
  if (!record["@type"]) {
    errors.push("Missing @type property on JSON-LD object.");
  }

  const scan = (val: unknown, path: string) => {
    if (val === undefined) {
      errors.push(`Undefined value at ${path}`);
      return;
    }
    if (typeof val === "number" && (Number.isNaN(val) || !Number.isFinite(val))) {
      errors.push(`Invalid numeric value (${String(val)}) at ${path}`);
      return;
    }
    if (typeof val === "string") {
      if (/\b(?:localhost|127\.0\.0\.1)\b/i.test(val)) {
        warnings.push(`Localhost reference found at ${path}: ${val}`);
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, idx) => scan(item, `${path}[${idx}]`));
      return;
    }
    if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (v === undefined) continue;
        scan(v, `${path}.${k}`);
      }
    }
  };

  scan(record, "$");
  return { valid: errors.length === 0, errors, warnings };
}
