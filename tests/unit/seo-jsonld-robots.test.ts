// @vitest-environment node
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/components/seo/JsonLd";
import {
  buildArticleJsonLd,
  buildBreadcrumbListJsonLd,
  buildCollectionJsonLd,
  buildJewelryStoreJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/seo/jsonld";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  buildCollectionCanonicalPath,
  buildMetadata,
  hasNonCanonicalCollectionQuery,
} from "@/lib/seo/metadata";
import { buildRobotsPolicy } from "@/lib/seo/robots-policy";
import type { ArticleDTO } from "@/modules/articles/article.service";
import type { PublicProductDetailDTO } from "@/modules/catalog/catalog.public";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

const mockSettings: PublicStoreSettings = {
  storeName: "Maison Aurelia",
  tagline: "Certified fine diamond jewellery.",
  contactEmail: "concierge@example.com",
  contactPhone: "+1-212-555-0148",
  supportHours: "Mon-Sat 10am-6pm EST",
  currency: "USD",
  defaultCountry: "US",
  supportedCountries: ["US", "CA", "GB"],
  taxRate: "0.0800",
  taxLabel: "Estimated Tax",
  taxInclusive: false,
  freeShippingThreshold: "1000.00",
  signatureThreshold: "500.00",
  returnWindowDays: 30,
  announcementBarEnabled: true,
  announcementBarText: "Complimentary insured shipping over $1,000",
  announcementBarHref: "/shipping-returns",
  logoUrl: "/images/logo.png",
  socialLinks: [{ label: "Instagram", href: "https://instagram.com/example" }],
  physicalStore: {
    name: "Maison Salon",
    streetAddress: "725 Fifth Avenue",
    city: "New York",
    state: "NY",
    postalCode: "10022",
    country: "US",
    hours: "Mo-Sa 10:00-18:00",
  },
  allowAiCrawlers: true,
  seoDefaultTitlePattern: "%s | Maison Aurelia",
  seoDefaultDescription: null,
  defaultOgImageUrl: null,
  updatedAt: "2026-11-10T00:00:00.000Z",
};

const mockZone: ShippingZoneDTO = {
  id: "zone-us",
  name: "United States",
  countries: ["US"],
  flatRate: "25.00",
  freeThreshold: "1000.00",
  estimatedDaysMin: 2,
  estimatedDaysMax: 4,
  isInsured: true,
  isActive: true,
  sortOrder: 1,
};

function makeProduct(overrides: Partial<PublicProductDetailDTO> = {}): PublicProductDetailDTO {
  return {
    id: "prod-1",
    sku: "AUR-RNG-001",
    name: "Celeste Cathedral Solitaire Ring",
    slug: "celeste-cathedral-solitaire-ring",
    subtitle: "Handcrafted platinum solitaire",
    description: "Signature 4-prong cathedral solitaire.",
    priceMode: "FIXED",
    basePrice: "4850.00",
    compareAtPrice: null,
    categoryId: "cat-1",
    categoryName: "Engagement Rings",
    categorySlug: "engagement-rings",
    categoryPath: "rings/engagement-rings",
    primaryImage: {
      id: "img-1",
      url: "/images/seed/celeste.webp",
      mediumUrl: null,
      thumbUrl: null,
      altText: "Celeste platinum solitaire diamond ring",
      width: 1200,
      height: 1500,
      isPrimary: true,
    },
    secondaryImage: null,
    metalType: "Platinum",
    metalPurity: "950",
    metalColor: "White",
    metalWeightGrams: "4.2",
    stoneShape: "Round Brilliant",
    stoneOrigin: "Natural",
    caratTotal: "1.50",
    caratCenter: "1.50",
    colorGrade: "E",
    clarityGrade: "VVS1",
    cutGrade: "Ideal",
    polishGrade: "Excellent",
    symmetryGrade: "Excellent",
    fluorescence: "None",
    certificationLab: "GIA",
    certificateNumber: "2195847123",
    certificateUrl: null,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    canonicalOverride: null,
    noindex: false,
    gtin: "0123456789012",
    mpn: "AUR-RNG-001",
    googleProductCategory: "Apparel & Accessories > Jewelry > Rings",
    isFeatured: true,
    isNewArrival: false,
    isBestseller: true,
    hasSizing: true,
    leadTimeDays: null,
    defaultVariantId: "var-1",
    totalAvailableStock: 3,
    updatedAt: "2026-11-10T00:00:00.000Z",
    breadcrumbs: [{ name: "Rings", path: "rings" }],
    images: [
      {
        id: "img-1",
        url: "/images/seed/celeste.webp",
        mediumUrl: null,
        thumbUrl: null,
        altText: "Celeste platinum solitaire diamond ring",
        width: 1200,
        height: 1500,
        isPrimary: true,
      },
    ],
    variants: [
      {
        id: "var-1",
        sku: "AUR-RNG-001-6",
        title: "Size 6 / Platinum",
        size: "6",
        metal: "950 Platinum",
        stoneSpec: "1.50 ct E VVS1",
        price: "4850.00",
        compareAtPrice: null,
        availableStock: 3,
        lowStockThreshold: 1,
        isDefault: true,
        weightGrams: "4.2",
      },
    ],
    attributes: [
      {
        facetCode: "setting",
        facetName: "Setting",
        valueLabel: "Cathedral",
        unit: null,
      },
    ],
    ...overrides,
  };
}

describe("Phase 7 Unit — JSON-LD Builders, Canonical Rules & Robots Policy", () => {
  it("escapes HTML-breaking characters in serializeJsonLd (SEO-13)", () => {
    const serialized = serializeJsonLd({
      "@context": "https://schema.org",
      "@type": "Thing",
      name: "</script><script>alert('xss')</script> & Diamonds > Gold",
    });

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).toContain("\\u003c");
    expect(serialized).toContain("\\u003e");
    expect(serialized).toContain("\\u0026");
  });

  it("builds Organization with MerchantReturnPolicy, WebSite SearchAction, and conditional JewelryStore", () => {
    const org = buildOrganizationJsonLd(mockSettings) as unknown as Record<string, unknown>;
    expect(org["@type"]).toBe("Organization");
    expect(org.hasMerchantReturnPolicy).toMatchObject({
      "@type": "MerchantReturnPolicy",
      merchantReturnDays: 30,
    });

    const website = buildWebSiteJsonLd(mockSettings) as unknown as Record<string, unknown>;
    expect(website["@type"]).toBe("WebSite");
    expect(website.potentialAction).toMatchObject({
      "@type": "SearchAction",
    });

    const store = buildJewelryStoreJsonLd(mockSettings) as unknown as Record<
      string,
      unknown
    > | null;
    expect(store).not.toBeNull();
    expect(store?.["@type"]).toBe("JewelryStore");

    const omittedStore = buildJewelryStoreJsonLd({ ...mockSettings, physicalStore: null });
    expect(omittedStore).toBeNull();
  });

  it("builds Product vs ProductGroup JSON-LD accurately and omits Offer on PRICE_ON_REQUEST (SEO-12, SEO-14)", () => {
    const singleProduct = buildProductJsonLd({
      product: makeProduct(),
      settings: mockSettings,
      defaultShippingZone: mockZone,
    });
    expect(singleProduct["@type"]).toBe("Product");
    if (singleProduct["@type"] === "Product") {
      expect(singleProduct.offers).toMatchObject({
        "@type": "Offer",
        price: "4850.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      });
      expect(singleProduct.additionalProperty).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Certification Lab", value: "GIA" }),
          expect.objectContaining({ name: "Color Grade", value: "E" }),
        ]),
      );
    }

    const multiVariantProduct = buildProductJsonLd({
      product: makeProduct({
        variants: [
          ...makeProduct().variants,
          {
            id: "var-2",
            sku: "AUR-RNG-001-7",
            title: "Size 7 / Platinum",
            size: "7",
            metal: "950 Platinum",
            stoneSpec: "1.50 ct E VVS1",
            price: "4950.00",
            compareAtPrice: null,
            availableStock: 0,
            lowStockThreshold: 1,
            isDefault: false,
            weightGrams: "4.4",
          },
        ],
      }),
      settings: mockSettings,
      defaultShippingZone: mockZone,
    });
    expect(multiVariantProduct["@type"]).toBe("ProductGroup");
    if (multiVariantProduct["@type"] === "ProductGroup") {
      expect(Array.isArray(multiVariantProduct.hasVariant)).toBe(true);
      expect((multiVariantProduct.hasVariant as unknown[]).length).toBe(2);
    }

    const bespokeProduct = buildProductJsonLd({
      product: makeProduct({ priceMode: "PRICE_ON_REQUEST" }),
      settings: mockSettings,
      defaultShippingZone: mockZone,
    });
    expect(bespokeProduct["@type"]).toBe("Product");
    expect("offers" in bespokeProduct).toBe(false);
  });

  it("builds CollectionPage ItemList, BreadcrumbList, and Article JSON-LD", () => {
    const collection = buildCollectionJsonLd({
      name: "Engagement Rings",
      description: "Certified solitaires",
      path: "/collections/rings/engagement-rings",
      items: [{ name: "Celeste", slug: "celeste-cathedral-solitaire-ring" }],
    });
    expect(collection["@type"]).toBe("CollectionPage");

    const breadcrumbs = buildBreadcrumbListJsonLd([
      { name: "Home", path: "/" },
      { name: "Rings", path: "/collections/rings" },
    ]);
    expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
    expect(breadcrumbs.itemListElement).toHaveLength(2);

    const mockArticle: ArticleDTO = {
      id: "art-1",
      title: "How to Choose an Engagement Diamond",
      slug: "how-to-choose-an-engagement-diamond",
      excerpt: "Understand cut proportions first.",
      bodyMarkdown: "## Proportions",
      coverImageUrl: null,
      coverAltText: null,
      authorName: "Claire Laurent",
      isPublished: true,
      publishedAt: "2026-10-01T12:00:00.000Z",
      seoTitle: null,
      seoDescription: null,
      relatedCategorySlug: "rings",
      updatedAt: "2026-11-01T12:00:00.000Z",
    };
    const articleSchema = buildArticleJsonLd({ article: mockArticle, settings: mockSettings });
    expect(articleSchema["@type"]).toBe("Article");
    expect(articleSchema.author).toMatchObject({ "@type": "Person", name: "Claire Laurent" });
  });

  it("enforces collection canonical rules and metadata robots directives (SEO-07, SEO-10)", () => {
    expect(hasNonCanonicalCollectionQuery({})).toBe(false);
    expect(hasNonCanonicalCollectionQuery({ page: "2" })).toBe(false);
    expect(hasNonCanonicalCollectionQuery({ metal: "Platinum" })).toBe(true);
    expect(hasNonCanonicalCollectionQuery({ sort: "price-asc" })).toBe(true);

    expect(buildCollectionCanonicalPath("/collections/rings", { page: "2" })).toEqual({
      canonicalPath: "/collections/rings?page=2",
      isFiltered: false,
    });
    expect(
      buildCollectionCanonicalPath("/collections/rings", {
        metal: "18K Yellow Gold",
        page: "2",
      }),
    ).toEqual({
      canonicalPath: "/collections/rings",
      isFiltered: true,
    });

    const filteredMeta = buildMetadata({
      title: "Rings",
      description: "Diamond rings",
      pathname: "/collections/rings",
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
    expect(filteredMeta.robots).toEqual({ index: false, follow: true });

    const cleanMeta = buildMetadata({
      title: "Rings",
      description: "Diamond rings",
      pathname: "/collections/rings",
      robots: INDEXABLE_ROBOTS,
    });
    expect(cleanMeta.robots).toMatchObject({
      index: true,
      follow: true,
      "max-image-preview": "large",
    });
  });

  it("permits search/retrieval crawlers while toggling AI training crawlers via allowAiCrawlers (SEO-18, AI-03)", () => {
    const permissive = buildRobotsPolicy(true, "https://maison.example");
    const permissiveRules = Array.isArray(permissive.rules) ? permissive.rules : [];
    const oaiSearch = permissiveRules.find((r) => r.userAgent === "OAI-SearchBot");
    const gptBotAllowed = permissiveRules.find((r) => r.userAgent === "GPTBot");

    expect(oaiSearch?.disallow).not.toContain("/search");
    expect(oaiSearch?.disallow).toContain("/admin");
    expect(gptBotAllowed?.allow).toEqual(expect.arrayContaining(["/"]));

    const restrictive = buildRobotsPolicy(false, "https://maison.example");
    const restrictiveRules = Array.isArray(restrictive.rules) ? restrictive.rules : [];
    const gptBotBlocked = restrictiveRules.find((r) => r.userAgent === "GPTBot");
    const claudeSearchStillAllowed = restrictiveRules.find(
      (r) => r.userAgent === "Claude-SearchBot",
    );

    expect(gptBotBlocked?.disallow).toBe("/");
    expect(claudeSearchStillAllowed?.allow).toEqual(expect.arrayContaining(["/"]));
    expect(restrictive.sitemap).toBe("https://maison.example/sitemap.xml");
  });
});
