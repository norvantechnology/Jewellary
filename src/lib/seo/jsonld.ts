import type {
  AboutPage,
  Article,
  BreadcrumbList,
  CollectionPage,
  ContactPage,
  JewelryStore,
  MerchantReturnPolicy,
  Offer,
  OfferShippingDetails,
  Organization,
  Product,
  ProductGroup,
  PropertyValue,
  SearchAction,
  WebSite,
  WithContext,
} from "schema-dts";
import { toAbsoluteUrl } from "@/lib/seo/metadata";
import type { ArticleDTO } from "@/modules/articles/article.service";
import type { PublicProductDetailDTO } from "@/modules/catalog/catalog.public";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

export function buildReturnPolicySchema(settings: PublicStoreSettings): MerchantReturnPolicy {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: settings.supportedCountries,
    returnPolicyCategory:
      settings.returnWindowDays > 0
        ? "https://schema.org/MerchantReturnFiniteReturnWindow"
        : "https://schema.org/MerchantReturnNotPermitted",
    ...(settings.returnWindowDays > 0
      ? {
          merchantReturnDays: settings.returnWindowDays,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        }
      : {}),
  };
}

export function buildShippingDetailsSchema(
  settings: PublicStoreSettings,
  zone: ShippingZoneDTO | null,
  itemPrice?: string,
): OfferShippingDetails | undefined {
  if (!zone) return undefined;
  const freeAt = zone.freeThreshold ?? settings.freeShippingThreshold;
  const qualifiesFree =
    freeAt !== null && itemPrice !== undefined && Number(itemPrice) >= Number(freeAt);

  const rateValue = qualifiesFree ? "0.00" : Number(zone.flatRate).toFixed(2);

  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: rateValue,
      currency: settings.currency,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: zone.countries.length > 0 ? zone.countries : settings.defaultCountry,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 2,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: zone.estimatedDaysMin,
        maxValue: zone.estimatedDaysMax,
        unitCode: "DAY",
      },
    },
  };
}

export function buildOrganizationJsonLd(settings: PublicStoreSettings): WithContext<Organization> {
  const siteUrl = toAbsoluteUrl("/");
  const logo = settings.logoUrl
    ? toAbsoluteUrl(settings.logoUrl)
    : toAbsoluteUrl("/opengraph-image");

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.storeName,
    url: siteUrl,
    logo,
    ...(settings.socialLinks.length > 0
      ? { sameAs: settings.socialLinks.map((link) => link.href) }
      : {}),
    contactPoint: {
      "@type": "ContactPoint",
      email: settings.contactEmail,
      ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
      contactType: "customer service",
      areaServed: settings.supportedCountries,
      availableLanguage: ["English"],
    },
    hasMerchantReturnPolicy: buildReturnPolicySchema(settings),
  };
}

export function buildWebSiteJsonLd(settings: PublicStoreSettings): WithContext<WebSite> {
  const searchAction: SearchAction & { "query-input": string } = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${toAbsoluteUrl("/search")}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  };

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.storeName,
    url: toAbsoluteUrl("/"),
    potentialAction: searchAction,
  };
}

export function buildJewelryStoreJsonLd(
  settings: PublicStoreSettings,
): WithContext<JewelryStore> | null {
  const store = settings.physicalStore;
  if (!store || !store.streetAddress || !store.city) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: store.name || settings.storeName,
    url: toAbsoluteUrl("/"),
    ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
    email: settings.contactEmail,
    ...(store.hours ? { openingHours: store.hours } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: store.streetAddress,
      addressLocality: store.city,
      ...(store.state ? { addressRegion: store.state } : {}),
      ...(store.postalCode ? { postalCode: store.postalCode } : {}),
      ...(store.country ? { addressCountry: store.country } : {}),
    },
  };
}

export function buildBreadcrumbListJsonLd(
  items: Array<{ name: string; path?: string }>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      ...(item.path ? { item: toAbsoluteUrl(item.path) } : {}),
    })),
  };
}

export function buildCollectionJsonLd(input: {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; slug: string }>;
}): WithContext<CollectionPage> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: toAbsoluteUrl(input.path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
        url: toAbsoluteUrl(`/products/${item.slug}`),
      })),
    },
  };
}

function buildProductProperties(product: PublicProductDetailDTO): PropertyValue[] {
  const props: PropertyValue[] = [];
  const pushProp = (name: string, value: string | null | undefined, unitText?: string | null) => {
    if (!value) return;
    props.push({
      "@type": "PropertyValue",
      name,
      value,
      ...(unitText ? { unitText } : {}),
    });
  };

  pushProp("Metal Purity", product.metalPurity);
  pushProp("Stone Origin", product.stoneOrigin);
  pushProp("Diamond Shape", product.stoneShape);
  pushProp("Total Carat Weight", product.caratTotal, "ct");
  pushProp("Center Carat Weight", product.caratCenter, "ct");
  pushProp("Cut Grade", product.cutGrade);
  pushProp("Color Grade", product.colorGrade);
  pushProp("Clarity Grade", product.clarityGrade);
  pushProp("Certification Lab", product.certificationLab);
  pushProp("Certificate Number", product.certificateNumber);

  for (const attr of product.attributes) {
    pushProp(attr.facetName, attr.valueLabel, attr.unit);
  }

  return props;
}

function buildVariantOffer(
  productUrl: string,
  price: string,
  inStock: boolean,
  settings: PublicStoreSettings,
  defaultShippingZone: ShippingZoneDTO | null,
): Offer {
  const shippingDetails = buildShippingDetailsSchema(settings, defaultShippingZone, price);

  return {
    "@type": "Offer",
    price: Number(price).toFixed(2),
    priceCurrency: settings.currency,
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    url: productUrl,
    seller: {
      "@type": "Organization",
      name: settings.storeName,
    },
    hasMerchantReturnPolicy: buildReturnPolicySchema(settings),
    ...(shippingDetails ? { shippingDetails } : {}),
  };
}

/**
 * Generates `ProductGroup` + `hasVariant` (when multiple active variants exist) or `Product` JSON-LD.
 * Explicitly omits price & Offer entries when `priceMode === "PRICE_ON_REQUEST"`.
 */
export function buildProductJsonLd(input: {
  product: PublicProductDetailDTO;
  settings: PublicStoreSettings;
  defaultShippingZone: ShippingZoneDTO | null;
}): WithContext<Product> | WithContext<ProductGroup> {
  const { product, settings, defaultShippingZone } = input;
  const canonicalUrl = product.canonicalOverride
    ? toAbsoluteUrl(product.canonicalOverride)
    : toAbsoluteUrl(`/products/${product.slug}`);
  const images = product.images.map((img) => toAbsoluteUrl(img.url));
  const properties = buildProductProperties(product);
  const returnPolicy = buildReturnPolicySchema(settings);
  const material = [product.metalPurity, product.metalType].filter(Boolean).join(" ") || undefined;

  if (product.variants.length > 1) {
    const hasVariant: Product[] = product.variants.map((variant) => {
      const variantOffer =
        product.priceMode === "FIXED"
          ? buildVariantOffer(
              canonicalUrl,
              variant.price,
              variant.availableStock > 0,
              settings,
              defaultShippingZone,
            )
          : undefined;

      return {
        "@type": "Product",
        sku: variant.sku,
        name: `${product.name} — ${variant.title}`,
        description: product.description ?? product.subtitle ?? product.name,
        url: canonicalUrl,
        ...(images.length > 0 ? { image: images } : {}),
        ...(variant.metal || material ? { material: variant.metal ?? material } : {}),
        ...(variant.size ? { size: variant.size } : {}),
        ...(product.metalColor ? { color: product.metalColor } : {}),
        ...(product.mpn ? { mpn: product.mpn } : {}),
        ...(product.gtin ? { gtin: product.gtin } : {}),
        brand: {
          "@type": "Brand",
          name: settings.storeName,
        },
        ...(variantOffer ? { offers: variantOffer } : {}),
      };
    });

    return {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      name: product.name,
      description: product.description ?? product.subtitle ?? product.name,
      productGroupID: product.sku,
      url: canonicalUrl,
      ...(images.length > 0 ? { image: images } : {}),
      category: product.categoryName,
      brand: {
        "@type": "Brand",
        name: settings.storeName,
      },
      variesBy: ["https://schema.org/size", "https://schema.org/material"],
      hasVariant,
      ...(properties.length > 0 ? { additionalProperty: properties } : {}),
    };
  }

  const primaryVariant = product.variants[0] ?? null;
  const offerPrice = primaryVariant?.price ?? product.basePrice;
  const inStock = primaryVariant
    ? primaryVariant.availableStock > 0
    : product.totalAvailableStock > 0;
  const offer =
    product.priceMode === "FIXED"
      ? buildVariantOffer(canonicalUrl, offerPrice, inStock, settings, defaultShippingZone)
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.subtitle ?? product.name,
    sku: primaryVariant?.sku ?? product.sku,
    url: canonicalUrl,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.gtin ? { gtin: product.gtin } : {}),
    ...(material ? { material } : {}),
    ...(product.metalColor ? { color: product.metalColor } : {}),
    ...(primaryVariant?.size ? { size: primaryVariant.size } : {}),
    category: product.categoryName,
    brand: {
      "@type": "Brand",
      name: settings.storeName,
    },
    ...(properties.length > 0 ? { additionalProperty: properties } : {}),
    ...(offer
      ? { offers: offer }
      : {
          // Price-on-request pieces still expose return policy without price/Offer
          mainEntityOfPage: canonicalUrl,
          subjectOf: {
            "@type": "WebPage",
            url: canonicalUrl,
            name: `${product.name} — Private Consultation`,
          },
        }),
    ...(returnPolicy ? {} : {}),
  };
}

export function buildArticleJsonLd(input: {
  article: ArticleDTO;
  settings: PublicStoreSettings;
}): WithContext<Article> {
  const { article, settings } = input;
  const articleUrl = toAbsoluteUrl(`/guides/${article.slug}`);
  const imageUrl = article.coverImageUrl
    ? toAbsoluteUrl(article.coverImageUrl)
    : toAbsoluteUrl("/opengraph-image");

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription ?? article.excerpt,
    image: [imageUrl],
    url: articleUrl,
    mainEntityOfPage: articleUrl,
    datePublished: article.publishedAt ?? article.updatedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Person",
      name: article.authorName,
      url: toAbsoluteUrl("/about"),
      description: `Senior Gemologist and Fine Jewellery Specialist at ${settings.storeName}.`,
    },
    publisher: {
      "@type": "Organization",
      name: settings.storeName,
      url: toAbsoluteUrl("/"),
      logo: {
        "@type": "ImageObject",
        url: settings.logoUrl ? toAbsoluteUrl(settings.logoUrl) : toAbsoluteUrl("/opengraph-image"),
      },
    },
  };
}

export function buildWebPageJsonLd(input: {
  type: "AboutPage" | "ContactPage";
  name: string;
  description: string;
  path: string;
  settings: PublicStoreSettings;
}): WithContext<AboutPage> | WithContext<ContactPage> {
  return {
    "@context": "https://schema.org",
    "@type": input.type,
    name: input.name,
    description: input.description,
    url: toAbsoluteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: input.settings.storeName,
      url: toAbsoluteUrl("/"),
    },
  };
}
