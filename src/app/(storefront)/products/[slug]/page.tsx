import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductDetailClient } from "@/components/storefront/ProductDetailClient";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { formatMoney } from "@/lib/money";
import { buildBreadcrumbListJsonLd, buildProductJsonLd } from "@/lib/seo/jsonld";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  buildMetadata,
  formatProductMetaDescription,
  formatProductMetaTitle,
} from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
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
    : undefined;

  return buildMetadata({
    title: formatProductMetaTitle(product),
    description: formatProductMetaDescription(product, settings.returnWindowDays),
    pathname: `/products/${product.slug}`,
    canonical: canonicalPath,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    images: ogImages,
    useSegmentOgImage: true,
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

  return (
    <Section spacing="sm">
      <JsonLd data={jsonLdBreadcrumbs} />
      <JsonLd data={productJsonLd} />
      <Container>
        <Breadcrumbs items={breadcrumbs} />

        <div className="mt-4 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <ProductGallery images={product.images} productName={product.name} />
          </div>

          <div className="lg:col-span-6">
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
        <section className="mt-14 grid gap-8 border-t border-border pt-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <p className="font-sans text-editorial-label text-accent-text">
              Provenance &amp; Care Questions
            </p>
            <h2 className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Frequently Asked About This Creation
            </h2>
            <div className="divide-y divide-border rounded-md border border-border bg-card">
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">
                  How are the diamonds and precious metals verified?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {product.certificationLab
                    ? `This creation is accompanied by its ${product.certificationLab} grading dossier${product.certificateNumber ? ` (#${product.certificateNumber})` : ""}, stamped metal purity mark${product.metalPurity ? ` (${product.metalPurity})` : ""}, and laser girdle inscription verification.`
                    : `Crafted in solid recycled ${product.metalType ?? "precious metal"}${product.metalPurity ? ` (${product.metalPurity})` : ""} and individually inspected under 10× magnification before dispatch.`}
                </p>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">
                  What are the insured delivery and return terms?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {deliveryLabel} Eligible unworn pieces may be returned within{" "}
                  {settings.returnWindowDays} days of delivery.
                </p>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">
                  Can ring sizing or metal finishes be customized?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {product.hasSizing
                    ? "Yes. Choose your preferred US size or metal finish above, or consult our "
                    : "Bespoke proportions or companion pieces can be arranged via our "}
                  <Link
                    href={product.hasSizing ? "/ring-size-guide" : "/contact?type=BESPOKE"}
                    className="text-accent-text underline underline-offset-4"
                  >
                    {product.hasSizing ? "Ring Size Guide" : "Private Concierge"}
                  </Link>{" "}
                  before reserving.
                </p>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:col-span-5">
            <p className="font-sans text-editorial-label text-accent-text">Atelier References</p>
            <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
              Explore Buying Guides
            </h2>
            <div className="space-y-3 rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap gap-2 border-b border-border pb-3 text-xs">
                <Link
                  href={`/collections/${product.categoryPath}`}
                  className="text-accent-text underline underline-offset-4"
                >
                  All {product.categoryName}
                </Link>
                <span aria-hidden="true">·</span>
                <Link
                  href="/shipping-returns"
                  className="text-accent-text underline underline-offset-4"
                >
                  Shipping &amp; Returns
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/care-guide" className="text-accent-text underline underline-offset-4">
                  Care Guide
                </Link>
              </div>
              {relatedGuides.length > 0 ? (
                <ul className="space-y-2.5 text-sm">
                  {relatedGuides.map((guide) => (
                    <li key={guide.id}>
                      <Link
                        href={`/guides/${guide.slug}`}
                        className="font-medium text-foreground hover:text-accent-text hover:underline"
                      >
                        {guide.title}
                      </Link>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{guide.excerpt}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Visit our{" "}
                  <Link href="/guides" className="text-accent-text underline underline-offset-4">
                    Diamond &amp; Fine Jewellery Guides
                  </Link>{" "}
                  for 4Cs grading and metal comparison notes.
                </p>
              )}
            </div>
          </aside>
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-14 border-t border-border pt-10">
            <p className="font-sans text-editorial-label text-accent-text">You May Also Admire</p>
            <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
              Complementary Pieces
            </h2>
            <Grid cols={4} className="mt-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} currency={settings.currency} />
              ))}
            </Grid>
          </section>
        )}
      </Container>
    </Section>
  );
}

export default function ProductPage(props: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div
              role="status"
              className="min-h-[120vh] space-y-6 py-4"
              aria-busy="true"
              aria-label="Loading piece dossier"
            >
              <div className="h-5 w-56 animate-pulse rounded bg-muted" />
              <div className="grid gap-10 lg:grid-cols-12">
                <div className="aspect-[4/5] animate-pulse rounded-md bg-muted lg:col-span-7" />
                <div className="space-y-4 lg:col-span-5">
                  <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-32 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <ProductPageBody {...props} />
    </Suspense>
  );
}
