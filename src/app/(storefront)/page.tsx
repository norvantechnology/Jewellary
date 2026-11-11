import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Container, Grid, Section } from "@/components/shared/primitives";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { INDEXABLE_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getHomepagePayload } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStoreSettings();
  return buildMetadata({
    absoluteTitle: `${settings.storeName} — Certified Diamonds & Fine Jewellery`,
    description:
      settings.seoDefaultDescription ??
      settings.tagline ??
      "Discover GIA and IGI certified diamonds, engagement rings, and heirloom 18K gold jewellery crafted with full grading transparency.",
    pathname: "/",
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: INDEXABLE_ROBOTS,
  });
}

export default async function HomePage() {
  const [payload, settings] = await Promise.all([getHomepagePayload(), getPublicStoreSettings()]);

  const heroBanner = payload.banners.hero[0] ?? null;
  const stripBanner = payload.banners.strip[0] ?? null;
  const editorialBanner = payload.banners.editorial[0] ?? null;

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-border bg-muted/40">
        <Container>
          <div className="grid items-center gap-10 py-14 lg:grid-cols-12 lg:py-20">
            <div className="space-y-5 lg:col-span-6">
              <Badge variant="outline">{settings.storeName} · Certified Fine Diamonds</Badge>
              <h1 className="font-display text-4xl leading-[1.08] font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {heroBanner?.title ?? "Timeless Form, Certified Radiance"}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {heroBanner?.subtitle ??
                  settings.tagline ??
                  "Handcrafted 18K gold and platinum heirlooms set with GIA and IGI certified diamonds."}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg">
                  <Link href={heroBanner?.ctaHref ?? "/collections"}>
                    {heroBanner?.ctaLabel ?? "Explore Collections"}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/contact?type=BESPOKE">Bespoke Consultation</Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-card shadow-card">
                {heroBanner ? (
                  <Image
                    src={heroBanner.imageUrl}
                    alt={heroBanner.altText}
                    fill
                    preload
                    fetchPriority="high"
                    sizes="(max-width: 1024px) 100vw, 48vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                    Atelier collection photography
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Top Collections Showcase */}
      <Section spacing="md">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-sans text-editorial-label text-accent-text">Curated Silhouette</p>
              <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
                Shop by Collection
              </h2>
            </div>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
            >
              <span>View all collections</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {payload.categories.slice(0, 4).map((category) => (
              <Link
                key={category.id}
                href={`/collections/${category.path}`}
                className="group flex flex-col justify-between rounded-md border border-border bg-card p-6 transition-colors hover:border-accent"
              >
                <div>
                  <p className="text-xs text-muted-foreground tabular-nums-price">
                    {category.productCount} {category.productCount === 1 ? "piece" : "pieces"}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-medium text-foreground group-hover:text-accent-text">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium tracking-wider text-accent-text uppercase">
                  <span>Discover</span>
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Featured Creations */}
      {payload.featuredProducts.length > 0 && (
        <Section spacing="md" className="border-y border-border bg-muted/25">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-sans text-editorial-label text-accent-text">
                  Atelier Highlights
                </p>
                <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
                  Featured Pieces
                </h2>
              </div>
              <Link
                href="/collections?featured=1"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
              >
                <span>Browse featured</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <Grid cols={4} className="mt-8">
              {payload.featuredProducts.slice(0, 4).map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={settings.currency}
                  priority={idx < 2}
                />
              ))}
            </Grid>
          </Container>
        </Section>
      )}

      {/* Editorial Promise Strip */}
      {stripBanner && (
        <section className="border-b border-border bg-card py-10">
          <Container>
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <p className="font-sans text-editorial-label text-accent-text">Provenance</p>
                <h2 className="mt-1 font-display text-2xl font-medium text-foreground">
                  {stripBanner.title}
                </h2>
                {stripBanner.subtitle && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{stripBanner.subtitle}</p>
                )}
              </div>
              {stripBanner.ctaHref && (
                <Button asChild variant="outline">
                  <Link href={stripBanner.ctaHref}>
                    {stripBanner.ctaLabel ?? "Explore Provenance"}
                  </Link>
                </Button>
              )}
            </div>
          </Container>
        </section>
      )}

      {/* New Arrivals & Signatures */}
      {(payload.newArrivals.length > 0 || payload.bestsellers.length > 0) && (
        <Section spacing="md">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-sans text-editorial-label text-accent-text">Recent Benchmarks</p>
                <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
                  New Arrivals &amp; House Signatures
                </h2>
              </div>
              <Link
                href="/collections"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
              >
                <span>Shop full collection</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <Grid cols={4} className="mt-8">
              {[...payload.newArrivals, ...payload.bestsellers]
                .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
                .slice(0, 4)
                .map((product) => (
                  <ProductCard key={product.id} product={product} currency={settings.currency} />
                ))}
            </Grid>
          </Container>
        </Section>
      )}

      {/* Bespoke Salon Feature */}
      <Section spacing="md" className="border-y border-border bg-muted/35">
        <Container>
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-sans text-editorial-label text-accent-text">Bespoke Studio</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                {editorialBanner?.title ?? "Private Stone Sourcing & Bespoke Design"}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {editorialBanner?.subtitle ??
                  "Work directly with our gemologists to compare individually graded parcels, refine cathedral or bezel geometry, and receive wax previews before casting."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={editorialBanner?.ctaHref ?? "/contact?type=BESPOKE"}>
                    {editorialBanner?.ctaLabel ?? "Speak with a Gemologist"}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/about">Our Atelier Standards</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5">
              <div className="rounded-md border border-border bg-card p-5">
                <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-display text-xl font-medium text-foreground">
                  GIA &amp; IGI Dossiers
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Every solitaire lists colour, clarity, cut, fluorescence, and lab certificate ID
                  upfront.
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-5">
                <Truck className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-display text-xl font-medium text-foreground">
                  Insured Delivery
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {settings.freeShippingThreshold
                    ? `Complimentary express delivery from ${formatMoney(settings.freeShippingThreshold, settings.currency)} `
                    : "Fully insured courier delivery "}
                  with adult signature release.
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-5 sm:col-span-2">
                <Sparkles className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-display text-xl font-medium text-foreground">
                  {settings.returnWindowDays}-Day Complimentary Returns &amp; Annual Care
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Thoughtful exchanges, ring-size verification, and lifetime prong checks for every
                  creation.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Buying & Diamond Guides */}
      {payload.articles.length > 0 && (
        <Section spacing="md">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-sans text-editorial-label text-accent-text">Editorial Notes</p>
                <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
                  Diamond &amp; Buying Guides
                </h2>
              </div>
              <Link
                href="/guides"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
              >
                <span>Read all guides</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {payload.articles.map((article) => (
                <article
                  key={article.id}
                  className="flex flex-col justify-between rounded-md border border-border bg-card p-6"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookOpen className="size-3.5 text-accent" aria-hidden="true" />
                      <span>By {article.authorName}</span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-medium text-foreground">
                      <Link href={`/guides/${article.slug}`} className="hover:underline">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {article.excerpt}
                    </p>
                  </div>
                  <Link
                    href={`/guides/${article.slug}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium tracking-wider text-accent-text uppercase hover:underline"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
