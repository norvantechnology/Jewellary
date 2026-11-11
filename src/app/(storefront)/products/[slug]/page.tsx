import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductDetailClient } from "@/components/storefront/ProductDetailClient";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await getPublicProductBySlug(slug);
  if (!resolved || resolved.kind !== "product") {
    return { title: "Fine Jewellery Creation" };
  }

  const { product } = resolved;
  return {
    title: product.seoTitle ?? product.name,
    description:
      product.seoDescription ??
      product.subtitle ??
      product.description?.slice(0, 155) ??
      `${product.name} crafted in fine precious metal and certified gemstones.`,
    robots: product.noindex ? { index: false, follow: true } : undefined,
    alternates: product.canonicalOverride ? { canonical: product.canonicalOverride } : undefined,
  };
}

async function ProductPageBody({ params }: ProductPageProps) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await getPublicProductBySlug(slug);

  if (!resolved) {
    notFound();
  }
  if (resolved.kind === "redirect") {
    permanentRedirect(`/products/${resolved.newSlug}`);
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

  return (
    <Section spacing="sm">
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

        {relatedProducts.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
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
            <div className="py-12 text-sm text-muted-foreground">Loading piece dossier…</div>
          </Container>
        </Section>
      }
    >
      <ProductPageBody {...props} />
    </Suspense>
  );
}
