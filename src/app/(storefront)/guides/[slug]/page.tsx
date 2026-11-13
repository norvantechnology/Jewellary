import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { EditorialToc } from "@/components/motion/EditorialToc";
import { Reveal, RevealStagger } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { injectHeadingIdsAndExtractToc } from "@/lib/editorial-toc";
import { renderSafeMarkdown } from "@/lib/markdown";
import {
  buildArticleJsonLd,
  buildBreadcrumbListJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/seo/jsonld";
import { INDEXABLE_ROBOTS, NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { resolvePublishedArticleBySlug } from "@/modules/articles/article.service";
import { queryCollectionProducts, resolveCategoryByPath } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface GuideDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GuideDetailPageProps): Promise<Metadata> {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await resolvePublishedArticleBySlug(slug);
  if (!resolved || resolved.kind !== "article") {
    return buildMetadata({
      title: "Diamond Buying Guide",
      description: "Independent gemological guidance and fine jewellery education.",
      pathname: "/guides",
      storeName: settings.storeName,
      siteDefaultOgImage: settings.defaultOgImageUrl,
    });
  }

  const { article } = resolved;
  const ogImg = article.ogImageUrl || article.coverImageUrl;
  return buildMetadata({
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.excerpt,
    keywords: article.seoKeywords ?? undefined,
    ogTitle: article.ogTitle ?? undefined,
    ogDescription: article.ogDescription ?? undefined,
    pathname: `/guides/${article.slug}`,
    canonical: article.canonicalOverride ?? `/guides/${article.slug}`,
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    type: "article",
    publishedTime: article.publishedAt ?? article.updatedAt,
    modifiedTime: article.updatedAt,
    authors: [article.authorName],
    images: ogImg
      ? [
          {
            url: ogImg,
            alt: article.coverAltText ?? article.title,
          },
        ]
      : undefined,
    useSegmentOgImage: true,
    robots: article.noindex ? NOINDEX_FOLLOW_ROBOTS : INDEXABLE_ROBOTS,
  });
}

async function GuideArticleBody({ params }: GuideDetailPageProps) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await resolvePublishedArticleBySlug(slug);

  if (!resolved) {
    notFound();
  }
  if (resolved.kind === "redirect") {
    permanentRedirect(`/guides/${resolved.newSlug}`);
  }

  const { article } = resolved;
  const [rawBodyHtml, initialRelatedCategory] = await Promise.all([
    renderSafeMarkdown(article.bodyMarkdown),
    article.relatedCategorySlug
      ? resolveCategoryByPath(article.relatedCategorySlug)
      : Promise.resolve(null),
  ]);
  const { html: bodyHtml, toc } = injectHeadingIdsAndExtractToc(rawBodyHtml);
  const showToc = toc.length >= 2;

  const resolvedRelatedPath =
    initialRelatedCategory?.kind === "category"
      ? initialRelatedCategory.category.path
      : initialRelatedCategory?.kind === "redirect"
        ? initialRelatedCategory.newPath
        : null;

  const relatedCategory =
    initialRelatedCategory?.kind === "category"
      ? initialRelatedCategory
      : resolvedRelatedPath
        ? await resolveCategoryByPath(resolvedRelatedPath)
        : null;

  const relatedProductsResult =
    relatedCategory && relatedCategory.kind === "category"
      ? await queryCollectionProducts({
          categoryPath: relatedCategory.category.path,
          categoryIds: relatedCategory.category.descendantIds,
          pageSize: 3,
        })
      : null;

  const articleJsonLd = buildArticleJsonLd({ article, settings });
  const faqJsonLd =
    article.seoFaqs && article.seoFaqs.length > 0 ? buildFaqPageJsonLd(article.seoFaqs) : null;
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: article.title, path: `/guides/${article.slug}` },
  ]);

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <JsonLd data={articleJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <JsonLd data={breadcrumbJsonLd} />
      <Container variant={showToc ? "default" : "prose"}>
        <div className={showToc ? "mx-auto max-w-[1020px]" : "w-full"}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Guides", href: "/guides" },
              { label: article.title },
            ]}
          />

          <header className="mt-4 max-w-[760px] border-b border-border pb-6">
            {article.articleSection && (
              <p className="mb-2 text-xs font-semibold tracking-wider text-accent-text uppercase">
                {article.articleSection}
              </p>
            )}
            <h1 className="type-h1 font-semibold break-words text-foreground">{article.title}</h1>
            <p className="prose-limit mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {article.excerpt}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground sm:text-sm">
              <span>
                Written by {article.authorName}
                {article.authorJobTitle ? ` · ${article.authorJobTitle}` : ""}
              </span>
              {article.authorCredentials && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{article.authorCredentials}</span>
                </>
              )}
              {article.publishedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Published{" "}
                    <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                Updated <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
              </span>
            </div>
          </header>

          {article.coverImageUrl && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl border border-border bg-surface-2">
              <Image
                src={article.coverImageUrl}
                alt={article.coverAltText ?? article.title}
                fill
                preload
                sizes="(max-width: 768px) 100vw, 768px"
                className={
                  article.coverImageUrl.startsWith("/images/seed/")
                    ? "object-cover object-center dark:brightness-90"
                    : "object-cover object-center"
                }
              />
            </div>
          )}

          <div
            className={
              showToc
                ? "mt-8 grid gap-10 lg:grid-cols-[minmax(0,720px)_220px] lg:items-start lg:justify-between"
                : "mt-8"
            }
          >
            <article
              className="editorial-prose max-w-[720px] min-w-0 space-y-5 text-foreground/90 [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:leading-[1.2] [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h2]:text-foreground [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:leading-[1.25] [&_h3]:font-semibold [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {showToc && (
              <aside aria-label="Table of contents" className="hidden lg:sticky lg:top-24 lg:block">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  On this page
                </p>
                <EditorialToc entries={toc} />
              </aside>
            )}
          </div>

          {article.seoFaqs && article.seoFaqs.length > 0 && (
            <section className="mt-10 max-w-[760px] space-y-4 border-t border-border pt-8">
              <h2 className="type-h2 font-display font-semibold text-foreground">
                Frequently Asked Questions
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border bg-card px-5">
                {article.seoFaqs.map((faq, idx) => (
                  <div key={idx} className="py-4">
                    <h3 className="text-base font-medium text-foreground">{faq.question}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {article.authorBio && (
            <aside className="mt-8 max-w-[760px] rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Editorial Author &amp; Gemological Review
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {article.authorName}
                {article.authorCredentials ? ` — ${article.authorCredentials}` : ""}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {article.authorBio}
              </p>
            </aside>
          )}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <div className="max-w-xl">
              <p className="type-h3 font-semibold text-foreground">
                Explore Pieces Mentioned in This Guide
              </p>
              <p className="mt-1.5 text-base leading-relaxed text-muted-foreground sm:text-sm">
                Compare GIA and IGI graded pieces directly in our collection or speak with a
                specialist.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap sm:w-auto">
              {resolvedRelatedPath && (
                <Button asChild className="w-full min-[480px]:w-auto">
                  <Link href={`/collections/${resolvedRelatedPath}`} className="gap-2">
                    <span>Shop Collection</span>
                    <ArrowRight className="size-5 stroke-[1.5]" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full min-[480px]:w-auto">
                <Link href="/contact?type=PRODUCT">Ask a Gemologist</Link>
              </Button>
            </div>
          </div>

          {relatedProductsResult && relatedProductsResult.items.length > 0 && (
            <div className="mt-12 border-t border-border pt-10">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Reveal>
                    <h2 className="type-h2 font-semibold text-foreground">
                      Corresponding Atelier Creations
                    </h2>
                  </Reveal>
                </div>
                {resolvedRelatedPath && (
                  <Link
                    href={`/collections/${resolvedRelatedPath}`}
                    className="ma-link-underline inline-flex min-h-11 items-center text-xs font-semibold tracking-wider text-accent-text uppercase"
                  >
                    View All
                  </Link>
                )}
              </div>
              <RevealStagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
                {relatedProductsResult.items.map((product) => (
                  <ProductCard key={product.id} product={product} currency={settings.currency} />
                ))}
              </RevealStagger>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}

// Existence is checked before streaming so unknown URLs return a real 404; that wait is intentional.
export const instant = false;

export default async function GuideDetailPage(props: GuideDetailPageProps) {
  // Check before the Suspense boundary so unknown slugs return a real HTTP 404.
  const { slug } = await props.params;
  if (!(await resolvePublishedArticleBySlug(slug))) notFound();

  return (
    <Suspense
      fallback={
        <Section spacing="md" className="pt-8 pb-10 sm:pb-16 lg:pb-24">
          <Container>
            <div className="mx-auto max-w-3xl space-y-6">
              <Skeleton className="h-4 w-48" />
              <div className="space-y-3 border-b border-border pb-6">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-full" />
              </div>
              <Skeleton className="aspect-[16/9] w-full rounded-lg" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <GuideArticleBody {...props} />
    </Suspense>
  );
}
