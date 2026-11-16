import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Compass,
  Gem,
  Lock,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal, RevealStagger, ScaleIn } from "@/components/motion/Reveal";
import { Container, Section, getProductGridClassName } from "@/components/shared/primitives";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroBannerImage } from "@/components/storefront/HeroBannerImage";
import { EtsyLogo } from "@/components/shared/EtsyLogo";
import { EtsyTrustSection } from "@/components/storefront/EtsyTrustSection";
import { HomeProductFinder } from "@/components/storefront/HomeProductFinder";
import { ProductCard } from "@/components/storefront/ProductCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { fill } from "@/lib/fill-text";
import { buildFaqPageJsonLd, buildJewelryStoreJsonLd } from "@/lib/seo/jsonld";
import { toAbsoluteUrl } from "@/lib/seo/site";
import { getHomeShapeTiles, getHomepagePayload } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.home.seo, { pathname: "/", absoluteTitle: true });
}

const STEP_ICONS = [Compass, Sparkles, Award];
const GUARANTEE_ICONS = [Award, Truck, ShieldCheck, Lock];

export default async function HomePage() {
  const [payload, settings, content, shapeTiles] = await Promise.all([
    getHomepagePayload(),
    getPublicStoreSettings(),
    getSiteContent(),
    getHomeShapeTiles().catch(() => []),
  ]);
  const home = content.pages.home;
  const faqJsonLd = home.faq.length > 0 ? buildFaqPageJsonLd(home.faq) : null;
  const jewelryStoreJsonLd = buildJewelryStoreJsonLd(settings);

  const heroBanner = payload.banners.hero[0] ?? null;
  const stripBanner = payload.banners.strip[0] ?? null;
  const editorialBanner = payload.banners.editorial[0] ?? null;
  const arrivalPieces = [...payload.newArrivals, ...payload.bestsellers]
    .filter((item, idx, arr) => arr.findIndex((p) => p.id === item.id) === idx)
    .slice(0, 8);

  // Featured pieces with their photos, so search engines see the product images on the home page.
  const homeItemListJsonLd =
    arrivalPieces.length > 0
      ? {
          "@context": "https://schema.org" as const,
          "@type": "ItemList" as const,
          name: `${settings.storeName} featured jewellery`,
          itemListElement: arrivalPieces.map((p, i) => ({
            "@type": "ListItem" as const,
            position: i + 1,
            url: toAbsoluteUrl(`/products/${p.slug}`),
            name: p.name,
            ...(p.primaryImage ? { image: toAbsoluteUrl(p.primaryImage.url) } : {}),
          })),
        }
      : null;

  const heroHeadline = heroBanner?.title ?? home.hero.headline;
  const heroWords = heroHeadline.split(/\s+/).filter(Boolean);
  const populatedCategories = payload.categories.filter((c) => c.productCount > 0);
  const featuredCategories = (
    populatedCategories.length > 0 ? populatedCategories : payload.categories
  ).slice(0, 4);

  return (
    <>
      {jewelryStoreJsonLd && <JsonLd data={jewelryStoreJsonLd} />}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      {homeItemListJsonLd && <JsonLd data={homeItemListJsonLd} />}
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
                {heroBanner?.subtitle ?? home.hero.subtitle}
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
                    <Link href={heroBanner?.ctaHref ?? home.hero.primaryCta.href}>
                      {heroBanner?.ctaLabel ?? home.hero.primaryCta.label}
                    </Link>
                  </Button>
                </Magnetic>
                <Button asChild variant="outline" size="lg" className="w-full min-[480px]:w-auto">
                  <Link href={home.hero.secondaryCta.href}>{home.hero.secondaryCta.label}</Link>
                </Button>
              </div>
              {home.etsy.url ? (
                <a
                  href={home.etsy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-1 inline-flex min-h-11 items-center gap-2.5 text-sm text-text-2 hover:text-text"
                >
                  <EtsyLogo size="md" />
                  <span className="underline-offset-4 group-hover:underline">
                    {home.etsy.heroLinkLabel}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(opens Etsy in a new tab)</span>
                </a>
              ) : null}
            </div>

            <div className="relative min-w-0 lg:col-span-5">
              <div className="ma-media-placeholder relative mx-auto w-full max-w-[560px] overflow-hidden rounded-xl border border-border shadow-sm lg:max-w-none lg:rounded-2xl">
                {heroBanner?.imageUrl ? (
                  <HeroBannerImage
                    desktopSrc={heroBanner.imageUrl}
                    mobileSrc={heroBanner.mobileImageUrl}
                    alt={heroBanner.altText ?? heroBanner.title}
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center">
                    <Gem
                      className="size-12 text-accent-text/55 dark:text-accent/55"
                      strokeWidth={1.25}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Trust bar: reassurance right under the hero */}
      <Section
        spacing="sm"
        className="border-b border-border bg-bg-alt"
        aria-label="Our guarantees"
      >
        <Container variant="wide">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-6 lg:grid-cols-4">
            {home.guarantees.map((item, idx) => {
              const GuaranteeIcon = GUARANTEE_ICONS[idx % GUARANTEE_ICONS.length]!;
              return (
                <div
                  key={`${item.title}-${idx}`}
                  className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left"
                >
                  <ScaleIn
                    delayMs={idx * 60}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent-text shadow-sm ring-1 ring-border"
                  >
                    <GuaranteeIcon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  </ScaleIn>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="mt-0.5 hidden text-sm text-text-2 sm:block">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* Also on Etsy: independent proof from verified buyers */}
      <EtsyTrustSection content={home.etsy} />

      {/* Shop by Collection */}
      {featuredCategories.length > 0 && (
        <Section
          className="bg-bg-alt py-10 md:py-16 lg:py-20"
          aria-labelledby="collections-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2 id="collections-heading" className="type-h2 font-display font-semibold text-text">
                {home.sections.collections.heading}
              </h2>
              <Link
                href="/collections"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>{home.sections.collections.linkLabel}</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
              {featuredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/collections/${category.path}`}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.05),0_10px_28px_-14px_rgb(0_0_0/0.22)] ring-1 ring-black/5 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_22px_44px_-18px_rgb(0_0_0/0.32)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:ring-white/10"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
                    {(category.thumbnailUrl ?? category.imageUrl) ? (
                      <Image
                        src={(category.thumbnailUrl ?? category.imageUrl)!}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 dark:brightness-90"
                      />
                    ) : (
                      <div className="ma-media-placeholder flex size-full items-center justify-center">
                        <Gem
                          className="size-8 text-accent-text/55 dark:text-accent/55"
                          strokeWidth={1.25}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 items-center justify-between gap-2 border-t border-border/60 px-3 py-3 sm:px-5 sm:py-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base leading-tight font-medium text-text sm:text-xl">
                        {category.name}
                      </h3>
                      <p className="tabular-nums-price mt-0.5 text-xs text-text-muted sm:text-sm">
                        {category.productCount > 0
                          ? `${category.productCount} ${category.productCount === 1 ? "piece" : "pieces"}`
                          : "Collection"}
                      </p>
                    </div>
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-text transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-on-primary sm:size-9">
                      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      <span className="sr-only">Shop {category.name}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </RevealStagger>
          </Container>
        </Section>
      )}

      {/* Shop by shape: round tiles linking to the shape landing pages */}
      {shapeTiles.length > 0 && (
        <Section
          className="border-t border-border bg-bg py-10 md:py-16 lg:py-20"
          aria-labelledby="shapes-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <h2 id="shapes-heading" className="type-h2 font-display font-semibold text-text">
                  {home.sections.shapes.heading}
                </h2>
                <p className="text-sm text-text-2">{home.sections.shapes.subheading}</p>
              </div>
              <Link
                href="/collections/rings/engagement-rings"
                className="ma-link-underline hidden min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none sm:inline-flex"
              >
                <span>{home.sections.shapes.linkLabel}</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>
            <RevealStagger className="grid grid-cols-4 gap-x-3 gap-y-5 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-8 lg:gap-x-5">
              {shapeTiles.map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="group flex min-w-0 flex-col items-center gap-2 text-center focus-visible:outline-none"
                >
                  <span className="relative block aspect-square w-full max-w-36 overflow-hidden rounded-full bg-surface-2 p-0.5 ring-1 ring-border transition-all duration-300 group-hover:ring-2 group-hover:ring-accent group-focus-visible:ring-2 group-focus-visible:ring-accent">
                    <span className="relative block size-full overflow-hidden rounded-full">
                      {tile.imageUrl ? (
                        <Image
                          src={tile.imageUrl}
                          alt={`${tile.name} engagement rings`}
                          fill
                          sizes="(min-width: 1024px) 144px, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <Gem
                          className="absolute inset-0 m-auto size-7 text-text-muted"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </span>
                  <span className="w-full min-w-0">
                    <span className="block truncate text-xs font-medium text-text group-hover:text-accent-text sm:text-sm">
                      {tile.name}
                    </span>
                    <span className="block truncate text-[11px] text-text-muted sm:text-xs">
                      {fill(home.sections.shapes.countLabel, { count: tile.count })}
                    </span>
                  </span>
                </Link>
              ))}
            </RevealStagger>
            <Button asChild variant="outline" className="mt-7 w-full sm:hidden">
              <Link href="/collections/rings/engagement-rings">
                {home.sections.shapes.linkLabel}
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Button>
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
                {home.sections.featured.heading}
              </h2>
              <Link
                href="/collections?featured=1"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>{home.sections.featured.linkLabel}</span>
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </Reveal>

            <RevealStagger className={getProductGridClassName("default")}>
              {payload.featuredProducts.slice(0, 8).map((product) => (
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
                {home.sections.newArrivals.heading}
              </h2>
              <Link
                href="/collections?new=1"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>{home.sections.newArrivals.linkLabel}</span>
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
                {editorialBanner?.title ?? home.custom.heading}
              </h2>
              <p className="prose-limit text-base leading-relaxed text-text-2">
                {editorialBanner?.subtitle ?? home.custom.text}
              </p>
              <div className="flex flex-col gap-3 pt-1 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
                <Button asChild className="w-full min-[480px]:w-auto">
                  <Link href={editorialBanner?.ctaHref ?? home.custom.primaryCta.href}>
                    {editorialBanner?.ctaLabel ?? home.custom.primaryCta.label}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full min-[480px]:w-auto">
                  <Link href={home.custom.secondaryCta.href}>{home.custom.secondaryCta.label}</Link>
                </Button>
              </div>
            </Reveal>

            <RevealStagger className="grid gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-7 lg:gap-6">
              {home.custom.steps.map((step, idx) => {
                const StepIcon = STEP_ICONS[idx % STEP_ICONS.length]!;
                return (
                  <div
                    key={`${step.title}-${idx}`}
                    className="ma-card-elevate flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-border-strong md:p-5 dark:hover:bg-surface-2"
                  >
                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                      <StepIcon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <h3 className="text-base leading-[1.35] font-medium text-text">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-text-muted">{step.text}</p>
                  </div>
                );
              })}
            </RevealStagger>
          </div>
        </Container>
      </Section>

      {/* FAQ: answers the common doubts before buying */}
      {home.faq.length > 0 && (
        <Section
          className="border-t border-border bg-bg-alt py-10 md:py-16 lg:py-20"
          aria-labelledby="home-faq-heading"
        >
          <Container variant="wide">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
              <Reveal className="space-y-3 lg:col-span-4">
                <h2 id="home-faq-heading" className="type-h2 font-display font-semibold text-text">
                  {home.sections.faq.heading}
                </h2>
                <Link
                  href="/faq"
                  className="ma-link-underline inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-text hover:text-accent-hover"
                >
                  <span>{home.sections.faq.linkLabel}</span>
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </Reveal>
              <Reveal className="lg:col-span-8">
                <Accordion
                  type="single"
                  collapsible
                  className="rounded-xl border border-border bg-surface px-4 shadow-sm sm:px-6"
                >
                  {home.faq.map((item, idx) => (
                    <AccordionItem key={item.question} value={`faq-${idx}`}>
                      <AccordionTrigger
                        headingLevel="h3"
                        className="min-h-14 py-4 text-left text-base font-medium"
                      >
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-relaxed text-text-2">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </Container>
        </Section>
      )}

      {/* Buying Guides */}
      {payload.articles.length > 0 && (
        <Section
          className="border-t border-border bg-bg py-10 md:py-16 lg:py-20"
          aria-labelledby="guides-heading"
        >
          <Container variant="wide">
            <Reveal className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
              <h2 id="guides-heading" className="type-h2 font-display font-semibold text-text">
                {home.sections.guides.heading}
              </h2>
              <Link
                href="/guides"
                className="ma-link-underline inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:text-accent-hover focus-visible:underline focus-visible:outline-none"
              >
                <span>{home.sections.guides.linkLabel}</span>
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
                      <span>{home.sections.guides.readLabel}</span>
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
    </>
  );
}
