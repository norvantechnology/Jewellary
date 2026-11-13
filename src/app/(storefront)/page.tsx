import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Compass, Gem, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Float, FloatSparkles } from "@/components/motion/Float";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal, RevealStagger, ScaleIn } from "@/components/motion/Reveal";
import { Container, Section, getProductGridClassName } from "@/components/shared/primitives";
import { JsonLd } from "@/components/seo/JsonLd";
import { HomeProductFinder } from "@/components/storefront/HomeProductFinder";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { buildJewelryStoreJsonLd } from "@/lib/seo/jsonld";
import { INDEXABLE_ROBOTS, NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getHomepagePayload } from "@/modules/catalog/catalog.public";
import { getStaticPageSeo } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, staticSeo] = await Promise.all([
    getPublicStoreSettings(),
    getStaticPageSeo("/"),
  ]);
  return buildMetadata({
    absoluteTitle:
      staticSeo?.seoTitle ?? `${settings.storeName} — Certified Diamonds & Fine Jewellery`,
    description:
      staticSeo?.seoDescription ??
      settings.seoDefaultDescription ??
      settings.tagline ??
      "Discover GIA and IGI certified diamonds, engagement rings, and heirloom 18K gold jewellery crafted with full grading transparency.",
    keywords: staticSeo?.seoKeywords ?? undefined,
    ogTitle: staticSeo?.ogTitle ?? undefined,
    ogDescription: staticSeo?.ogDescription ?? undefined,
    images: staticSeo?.ogImageUrl
      ? [{ url: staticSeo.ogImageUrl, alt: settings.storeName, width: 1200, height: 630 }]
      : undefined,
    pathname: "/",
    canonical: staticSeo?.canonicalOverride ?? "/",
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: staticSeo?.noindex ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
  });
}

export default async function HomePage() {
  const [payload, settings] = await Promise.all([getHomepagePayload(), getPublicStoreSettings()]);
  const jewelryStoreJsonLd = buildJewelryStoreJsonLd(settings);

  const heroBanner = payload.banners.hero[0] ?? null;
  const stripBanner = payload.banners.strip[0] ?? null;
  const editorialBanner = payload.banners.editorial[0] ?? null;
  const arrivalPieces = [...payload.newArrivals, ...payload.bestsellers]
    .filter((item, idx, arr) => arr.findIndex((p) => p.id === item.id) === idx)
    .slice(0, 4);

  const heroHeadline = heroBanner?.title ?? "Timeless Form, Certified Radiance";
  const heroWords = heroHeadline.split(/\s+/).filter(Boolean);
  const populatedCategories = payload.categories.filter((c) => c.productCount > 0);
  const featuredCategories = (
    populatedCategories.length > 0 ? populatedCategories : payload.categories
  ).slice(0, 4);

  return (
    <>
      {jewelryStoreJsonLd && <JsonLd data={jewelryStoreJsonLd} />}
      {/* Hero & Instant Product Discovery */}
      <Section className="overflow-x-clip border-b border-border bg-bg py-8 sm:py-12 lg:py-16">
        <Container variant="wide">
          <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 space-y-4 sm:space-y-5 lg:col-span-7">
              <h1 className="type-h1 line-clamp-3 font-display font-semibold text-text">
                {heroWords.map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="ma-hero-line mr-[0.26em] inline-block last:mr-0"
                    style={{
                      ["--ma-delay" as string]: `${Math.min(index, 6) * 45}ms`,
                    }}
                  >
                    {word}
                  </span>
                ))}
              </h1>

              <p
                className="ma-hero-line prose-limit text-base leading-relaxed text-text-2 sm:text-lg"
                style={{ ["--ma-delay" as string]: "140ms" }}
              >
                {heroBanner?.subtitle ??
                  "GIA-graded diamonds sculpted into low-profile cathedral mounts in 18K recycled gold and 950 platinum."}
              </p>

              {/* Prominent instant product finder & quick category bar */}
              <div className="pt-1">
                <HomeProductFinder categories={payload.categories} currency={settings.currency} />
              </div>

              <div
                className="ma-hero-line flex flex-col gap-3 pt-1 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center"
                style={{ ["--ma-delay" as string]: "220ms" }}
              >
                <Magnetic strength={4} className="w-full min-[480px]:w-auto">
                  <Button asChild size="lg" className="w-full min-[480px]:w-auto">
                    <Link href={heroBanner?.ctaHref ?? "/collections"}>
                      {heroBanner?.ctaLabel ?? "Explore collections"}
                    </Link>
                  </Button>
                </Magnetic>
                <Button asChild variant="outline" size="lg" className="w-full min-[480px]:w-auto">
                  <Link href="/contact?type=BESPOKE">Book consultation</Link>
                </Button>
              </div>
            </div>

            <div className="relative min-w-0 lg:col-span-5">
              <div
                className="ma-hero-aura pointer-events-none absolute -inset-4 rounded-3xl"
                aria-hidden="true"
              />
              <div className="ma-hero-parallax ma-media-placeholder relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border shadow-sm sm:aspect-[4/3] lg:aspect-square lg:rounded-2xl">
                <Float amplitude={8} duration={7} rotate={1.5} className="relative size-full">
                  {heroBanner?.imageUrl ? (
                    <Image
                      src={heroBanner.imageUrl}
                      alt={heroBanner.altText ?? heroBanner.title}
                      fill
                      preload
                      sizes="(max-width: 1024px) 100vw, 42vw"
                      className="ma-hero-media scale-[1.04] object-cover object-center dark:brightness-90"
                    />
                  ) : (
                    <div className="ma-hero-media flex size-full items-center justify-center">
                      <Gem
                        className="size-12 text-accent-text/55 dark:text-accent/55"
                        strokeWidth={1.25}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </Float>
                <div className="hidden sm:block" aria-hidden="true">
                  <FloatSparkles />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Shop by Collection */}
      {featuredCategories.length > 0 && (
        <Section
          className="bg-bg-alt py-10 md:py-16 lg:py-20"
          aria-labelledby="collections-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2 id="collections-heading" className="type-h2 font-display font-semibold text-text">
                Shop by Collection
              </h2>
              <Link
                href="/collections"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>View all</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
              {featuredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/collections/${category.path}`}
                  className="ma-card-elevate group transition-ui flex flex-col rounded-xl border border-border bg-surface shadow-sm hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] dark:hover:bg-surface-2"
                >
                  <div className="ma-media-placeholder relative aspect-[4/3] w-full overflow-hidden rounded-t-xl">
                    {category.imageUrl ? (
                      <Image
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="ma-collection-img object-cover object-center dark:brightness-90"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Gem
                          className="ma-collection-img size-7 text-accent-text/55 sm:size-8 dark:text-accent/55"
                          strokeWidth={1.25}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4 md:p-5">
                    <h3 className="line-clamp-2 text-sm leading-[1.35] font-medium text-text sm:text-base">
                      {category.name}
                    </h3>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
                      {category.productCount > 0 ? (
                        <span className="tabular-nums-price text-text-muted">
                          {category.productCount} {category.productCount === 1 ? "piece" : "pieces"}
                        </span>
                      ) : (
                        <span className="text-text-muted">Collection</span>
                      )}
                      <span className="inline-flex items-center gap-1 font-medium text-accent-text opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                        <span className="hidden sm:inline">Discover</span>
                        <ArrowRight
                          className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-1 sm:size-4"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </RevealStagger>
          </Container>
        </Section>
      )}

      {/* Featured Pieces */}
      {payload.featuredProducts.length > 0 && (
        <Section
          className="border-t border-border bg-bg py-10 md:py-16 lg:py-20"
          aria-labelledby="featured-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2 id="featured-heading" className="type-h2 font-display font-semibold text-text">
                Featured Pieces
              </h2>
              <Link
                href="/collections?featured=1"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>Shop featured</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className={getProductGridClassName("default")}>
              {payload.featuredProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} currency={settings.currency} />
              ))}
            </RevealStagger>
          </Container>
        </Section>
      )}

      {/* Editorial Strip Banner */}
      {stripBanner && (
        <Section spacing="sm" className="border-t border-border bg-bg-alt">
          <Container variant="wide">
            <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="max-w-2xl space-y-1">
                <h2 className="type-h3 font-display font-semibold text-text">
                  {stripBanner.title}
                </h2>
                {stripBanner.subtitle && (
                  <p className="prose-limit text-sm text-text-2">{stripBanner.subtitle}</p>
                )}
              </div>
              {stripBanner.ctaHref && (
                <Button asChild variant="outline" className="w-full shrink-0 sm:w-auto">
                  <Link href={stripBanner.ctaHref}>{stripBanner.ctaLabel ?? "Explore"}</Link>
                </Button>
              )}
            </Reveal>
          </Container>
        </Section>
      )}

      {/* New Arrivals */}
      {arrivalPieces.length > 0 && (
        <Section
          className="border-t border-border bg-bg py-10 md:py-16 lg:py-20"
          aria-labelledby="new-arrivals-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2
                id="new-arrivals-heading"
                className="type-h2 font-display font-semibold text-text"
              >
                New Arrivals
              </h2>
              <Link
                href="/collections?new=1"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>View new arrivals</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className={getProductGridClassName("default")}>
              {arrivalPieces.map((product) => (
                <ProductCard key={product.id} product={product} currency={settings.currency} />
              ))}
            </RevealStagger>
          </Container>
        </Section>
      )}

      {/* Bespoke Salon */}
      <Section
        className="border-t border-border bg-bg-alt py-10 md:py-16 lg:py-20"
        aria-labelledby="bespoke-heading"
      >
        <Container variant="wide">
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
            <Reveal className="space-y-4 lg:col-span-5">
              <h2 id="bespoke-heading" className="type-h2 font-display font-semibold text-text">
                {editorialBanner?.title ?? "Custom Design"}
              </h2>
              <p className="prose-limit text-base leading-relaxed text-text-2">
                {editorialBanner?.subtitle ??
                  "Design an engagement ring or anniversary piece around a GIA-certified diamond."}
              </p>
              <div className="flex flex-col gap-3 pt-1 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
                <Button asChild className="w-full min-[480px]:w-auto">
                  <Link href={editorialBanner?.ctaHref ?? "/contact?type=BESPOKE"}>
                    {editorialBanner?.ctaLabel ?? "Speak with a gemologist"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full min-[480px]:w-auto">
                  <Link href="/about">About us</Link>
                </Button>
              </div>
            </Reveal>

            <RevealStagger className="grid gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-7 lg:gap-6">
              <div className="ma-card-elevate flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-border-strong md:p-5 dark:hover:bg-surface-2">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                  <Compass className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-base leading-[1.35] font-medium text-text">Stone selection</h3>
                <p className="mt-1.5 text-sm text-text-muted">
                  Hand-vetted natural and lab-grown stones matched for light return.
                </p>
              </div>

              <div className="ma-card-elevate flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-border-strong md:p-5 dark:hover:bg-surface-2">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                  <Sparkles className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-base leading-[1.35] font-medium text-text">Bench craft</h3>
                <p className="mt-1.5 text-sm text-text-muted">
                  Cast in 18K recycled gold or 950 platinum with precision prong work.
                </p>
              </div>

              <div className="ma-card-elevate flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-border-strong md:p-5 dark:hover:bg-surface-2">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                  <Award className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-base leading-[1.35] font-medium text-text">
                  Full certification
                </h3>
                <p className="mt-1.5 text-sm text-text-muted">
                  Delivered with numbered GIA or IGI laboratory dossiers and valuation.
                </p>
              </div>
            </RevealStagger>
          </div>
        </Container>
      </Section>

      {/* Buying Guides */}
      {payload.articles.length > 0 && (
        <Section
          className="border-t border-border bg-bg py-10 md:py-16 lg:py-20"
          aria-labelledby="guides-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2 id="guides-heading" className="type-h2 font-display font-semibold text-text">
                Buying Guides
              </h2>
              <Link
                href="/guides"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>All guides</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className="grid gap-4 md:grid-cols-3 lg:gap-6">
              {payload.articles.slice(0, 3).map((article) => (
                <article
                  key={article.id}
                  className="ma-card-elevate ma-card-lift-lg flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-border-strong md:p-5 dark:hover:bg-surface-2"
                >
                  <p className="truncate text-xs text-text-muted">{article.authorName}</p>
                  <h3 className="mt-2 line-clamp-2 text-base leading-[1.35] font-medium text-text sm:text-lg">
                    <Link
                      href={`/guides/${article.slug}`}
                      className="transition-colors hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-text-2">{article.excerpt}</p>
                  <div className="mt-auto pt-3">
                    <Link
                      href={`/guides/${article.slug}`}
                      className="ma-link-underline group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text hover:text-accent-hover"
                    >
                      <span>Read guide</span>
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </article>
              ))}
            </RevealStagger>
          </Container>
        </Section>
      )}

      {/* Single 3-Item Trust Strip (shown once above footer) */}
      <Section
        spacing="sm"
        className="border-y border-border bg-bg-alt"
        aria-label="Our guarantees"
      >
        <Container variant="wide">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
              <ScaleIn className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-text shadow-sm ring-1 ring-border">
                <Award className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </ScaleIn>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">Certified provenance</p>
                <p className="mt-0.5 hidden text-sm text-text-2 sm:block">
                  GIA and IGI graded stones with hallmarked 18K gold and 950 platinum.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
              <ScaleIn
                delayMs={60}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-text shadow-sm ring-1 ring-border"
              >
                <Truck className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </ScaleIn>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">Insured delivery</p>
                <p className="mt-0.5 hidden text-sm text-text-2 sm:block">
                  Signature-required armored or courier transit worldwide.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
              <ScaleIn
                delayMs={120}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-text shadow-sm ring-1 ring-border"
              >
                <ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </ScaleIn>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">
                  {settings.returnWindowDays}-day returns
                </p>
                <p className="mt-0.5 hidden text-sm text-text-2 sm:block">
                  Complimentary resizing and returns on unworn pieces.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
