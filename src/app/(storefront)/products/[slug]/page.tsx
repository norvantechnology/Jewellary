import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Reveal, RevealStagger } from "@/components/motion/Reveal";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductDetailClient } from "@/components/storefront/ProductDetailClient";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import {
  RecentlyViewedProducts,
  RecordRecentlyViewed,
} from "@/components/storefront/RecentlyViewedProducts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatMoney } from "@/lib/money";
import {
  buildBreadcrumbListJsonLd,
  buildFaqPageJsonLd,
  buildImageObjectsJsonLd,
  buildProductJsonLd,
} from "@/lib/seo/jsonld";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  buildMetadata,
  formatProductMetaDescription,
  formatProductMetaTitle,
} from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getPublicProductBySlug, getSitemapProducts } from "@/modules/catalog/catalog.public";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const products = await getSitemapProducts(0, 200);
    if (products.length > 0) {
      return products.map((product) => ({ slug: product.slug }));
    }
  } catch {
    // Allow build without live database (e.g. multi-stage Docker build).
  }
  return [{ slug: "celeste-cathedral-solitaire-ring" }];
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await getPublicProductBySlug(slug);
  if (!resolved || resolved.kind !== "product") {
    return buildMetadata({
      title: "Fine Jewellery Creation",
      description: "Explore GIA and IGI certified diamonds and fine heirloom pieces.",
      pathname: `/products/${slug}`,
      storeName: settings.storeName,
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
  }

  const { product } = resolved;
  const canonicalPath = product.canonicalOverride ?? `/products/${product.slug}`;
  const ogImages = product.ogImageUrl
    ? [{ url: product.ogImageUrl, alt: product.name, width: 1200, height: 630 }]
    : product.images[0]?.url && !product.images[0].url.endsWith(".svg")
      ? [
          {
            url: product.images[0].url,
            alt: product.images[0].altText ?? product.name,
            width: 1200,
            height: 1200,
          },
        ]
      : undefined;

  const priceText =
    product.priceMode === "PRICE_ON_REQUEST"
      ? "Price upon request"
      : formatMoney(Number(product.basePrice), settings.currency);

  const hasStock =
    product.variants.length > 0
      ? product.variants.some((v) => v.availableStock > 0)
      : product.totalAvailableStock > 0;

  return buildMetadata({
    absoluteTitle: formatProductMetaTitle(product, {
      storeName: settings.storeName,
      templates: settings.seoTemplates,
      priceText,
    }),
    description: formatProductMetaDescription(product, settings.returnWindowDays, {
      storeName: settings.storeName,
      templates: settings.seoTemplates,
      priceText,
    }),
    keywords: product.seoKeywords ?? undefined,
    ogTitle: product.ogTitle ?? undefined,
    ogDescription: product.ogDescription ?? undefined,
    pathname: `/products/${product.slug}`,
    canonical: canonicalPath,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    images: ogImages,
    useSegmentOgImage: true,
    pinterestProduct:
      product.priceMode === "FIXED"
        ? {
            priceAmount: Number(product.basePrice).toFixed(2),
            priceCurrency: settings.currency,
            availability: hasStock ? "instock" : "oos",
          }
        : undefined,
    robots: product.noindex ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
  });
}

async function ProductPageBody({ params }: ProductPageProps) {
  const [{ slug }, settings, zones, articles] = await Promise.all([
    params,
    getPublicStoreSettings(),
    getAllShippingZones(true),
    getPublishedArticles(),
  ]);
  const resolved = await getPublicProductBySlug(slug);

  if (!resolved) {
    notFound();
  }
  if (resolved.kind === "redirect") {
    permanentRedirect(`/products/${resolved.newSlug}`);
  }
  if (resolved.kind === "redirect-category") {
    permanentRedirect(`/collections/${resolved.categoryPath}`);
  }

  const { product, relatedProducts } = resolved;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Collections", href: "/collections" },
    ...product.breadcrumbs.map((crumb) => ({
      label: crumb.name,
      href: `/collections/${crumb.path}`,
    })),
    { label: product.name },
  ];

  const jsonLdBreadcrumbs = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Collections", path: "/collections" },
    ...product.breadcrumbs.map((crumb) => ({
      name: crumb.name,
      path: `/collections/${crumb.path}`,
    })),
    { name: product.name, path: `/products/${product.slug}` },
  ]);

  const defaultZone =
    zones.find((z) => z.countries.includes(settings.defaultCountry)) ?? zones[0] ?? null;

  const productJsonLd = buildProductJsonLd({
    product,
    settings,
    defaultShippingZone: defaultZone,
  });

  const relatedGuides = articles
    .filter(
      (a) =>
        !a.relatedCategorySlug ||
        product.categoryPath === a.relatedCategorySlug ||
        product.categoryPath.startsWith(`${a.relatedCategorySlug}/`),
    )
    .slice(0, 3);

  const deliveryLabel = settings.freeShippingThreshold
    ? `Complimentary insured express delivery applies from ${formatMoney(settings.freeShippingThreshold, settings.currency)}, with adult signature required at or above ${formatMoney(settings.signatureThreshold, settings.currency)}.`
    : `Every parcel travels fully insured with adult signature confirmation from ${formatMoney(settings.signatureThreshold, settings.currency)}.`;

  const certFaqAnswer = product.certificationLab
    ? `This creation is accompanied by its ${product.certificationLab} grading dossier${product.certificateNumber ? ` (#${product.certificateNumber})` : ""}, stamped metal purity mark${product.metalPurity ? ` (${product.metalPurity})` : ""}, and laser girdle inscription verification.`
    : `Crafted in solid recycled ${product.metalType ?? "precious metal"}${product.metalPurity ? ` (${product.metalPurity})` : ""} and individually inspected under 10× magnification before dispatch.`;

  const customFaqs = product.seoFaqs ?? [];
  const combinedFaqs = [
    { question: "How are the diamonds and precious metals verified?", answer: certFaqAnswer },
    {
      question: "What are the insured delivery and return terms?",
      answer: `${deliveryLabel} Eligible unworn pieces may be returned within ${settings.returnWindowDays} days of delivery.`,
    },
    ...(product.warrantyText
      ? [
          {
            question: "What lifetime care and warranty coverage applies?",
            answer: product.warrantyText,
          },
        ]
      : []),
    ...customFaqs,
  ];
  const faqJsonLd = buildFaqPageJsonLd(combinedFaqs);
  const imageObjectsJsonLd = buildImageObjectsJsonLd({
    images: product.images.map((img) => ({
      url: img.url,
      altText: img.altText ?? product.name,
      title: img.title,
      caption: img.caption,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
    })),
    settings,
  });

  return (
    <Section spacing="sm">
      <JsonLd data={jsonLdBreadcrumbs} />
      <JsonLd data={productJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      {imageObjectsJsonLd.map((imgSchema, i) => (
        <JsonLd key={i} data={imgSchema} />
      ))}
      <Container>
        <Breadcrumbs items={breadcrumbs} compactOnMobile />

        <div className="mt-4 grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <ProductGallery images={product.images} productName={product.name} />
          </div>

          <div className="lg:sticky lg:top-24 lg:col-span-6">
            <ProductDetailClient
              product={product}
              currency={settings.currency}
              freeShippingThreshold={settings.freeShippingThreshold}
              signatureThreshold={settings.signatureThreshold}
              returnWindowDays={settings.returnWindowDays}
            />
          </div>
        </div>

        {/* Piece Questions & Gemology References (AEO + Internal Linking) */}
        <section className="mt-10 grid gap-8 border-t border-border pt-12 sm:mt-16 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <Reveal>
              <h2 className="type-h2 font-display font-semibold text-foreground">
                Frequently Asked Questions
              </h2>
            </Reveal>
            <Accordion
              type="single"
              collapsible
              className="rounded-xl border border-border bg-card px-4 sm:px-5"
            >
              <AccordionItem value="faq-1">
                <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium">
                  How are the diamonds and precious metals verified?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {product.certificationLab
                    ? `This creation is accompanied by its ${product.certificationLab} grading dossier${product.certificateNumber ? ` (#${product.certificateNumber})` : ""}, stamped metal purity mark${product.metalPurity ? ` (${product.metalPurity})` : ""}, and laser girdle inscription verification.`
                    : `Crafted in solid recycled ${product.metalType ?? "precious metal"}${product.metalPurity ? ` (${product.metalPurity})` : ""} and individually inspected under 10× magnification before dispatch.`}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-2">
                <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium">
                  What are the insured delivery and return terms?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {deliveryLabel} Eligible unworn pieces may be returned within{" "}
                  {settings.returnWindowDays} days of delivery.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="faq-3"
                className={customFaqs.length > 0 || product.warrantyText ? undefined : "border-b-0"}
              >
                <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium">
                  Can ring sizing or metal finishes be customized?
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {product.hasSizing
                    ? "Yes. Choose your preferred US size or metal finish above, or consult our "
                    : "Bespoke proportions or companion pieces can be arranged via our "}
                  <Link
                    href={product.hasSizing ? "/ring-size-guide" : "/contact?type=BESPOKE"}
                    className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4 hover:text-accent-hover"
                  >
                    {product.hasSizing ? "Ring Size Guide" : "Private Concierge"}
                  </Link>{" "}
                  before reserving.
                </AccordionContent>
              </AccordionItem>

              {product.warrantyText && (
                <AccordionItem
                  value="faq-warranty"
                  className={customFaqs.length > 0 ? undefined : "border-b-0"}
                >
                  <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium">
                    What lifetime care and warranty coverage applies?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {product.warrantyText}
                  </AccordionContent>
                </AccordionItem>
              )}

              {customFaqs.map((faq, idx) => (
                <AccordionItem
                  key={idx}
                  value={`faq-custom-${idx}`}
                  className={idx === customFaqs.length - 1 ? "border-b-0" : undefined}
                >
                  <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <aside className="space-y-4 lg:col-span-5">
            <Reveal delayMs={50}>
              <h2 className="type-h2 font-display font-semibold text-foreground">Buying Guides</h2>
            </Reveal>
            <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3 text-xs font-medium">
                <Link
                  href={`/collections/${product.categoryPath}`}
                  className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4 hover:text-accent-hover"
                >
                  All {product.categoryName}
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <Link
                  href="/shipping-returns"
                  className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4 hover:text-accent-hover"
                >
                  Shipping &amp; Returns
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <Link
                  href="/care-guide"
                  className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4 hover:text-accent-hover"
                >
                  Care Guide
                </Link>
              </div>
              {relatedGuides.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {relatedGuides.map((guide) => (
                    <li key={guide.id}>
                      <Link
                        href={`/guides/${guide.slug}`}
                        className="inline-flex min-h-11 items-center font-medium text-foreground hover:text-accent-text hover:underline"
                      >
                        {guide.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {guide.excerpt}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Visit our{" "}
                  <Link
                    href="/guides"
                    className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4"
                  >
                    Diamond &amp; Fine Jewellery Guides
                  </Link>{" "}
                  for 4Cs grading and metal comparison notes.
                </p>
              )}
            </div>
          </aside>
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-12 border-t border-border pt-10 sm:mt-16 sm:pt-12">
            <Reveal>
              <h2 className="type-h2 font-display font-semibold text-foreground">
                Complementary Pieces
              </h2>
            </Reveal>
            <RevealStagger className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} currency={settings.currency} />
              ))}
            </RevealStagger>
          </section>
        )}

        <RecordRecentlyViewed productId={product.id} />
        <RecentlyViewedProducts excludeProductId={product.id} currency={settings.currency} />
      </Container>
    </Section>
  );
}

// Unknown slugs must return a real 404 before streaming; that wait is intentional.
export const instant = false;

export default function ProductPage(props: ProductPageProps) {
  return <ProductPageBody {...props} />;
}
