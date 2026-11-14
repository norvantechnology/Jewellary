import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { RevealStagger } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container, Section } from "@/components/shared/primitives";
import { formatDate } from "@/lib/dates";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { getPublishedArticles } from "@/modules/articles/article.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.guides.seo, { pathname: "/guides" });
}

export default async function GuidesIndexPage() {
  const [articles, content] = await Promise.all([getPublishedArticles(), getSiteContent()]);
  const page = content.pages.guides;
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
  ]);

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <JsonLd data={breadcrumbJsonLd} />
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />

        <header className="mt-3 mb-6 border-b border-border pb-6 md:mb-10">
          <h1 className="type-h1 font-semibold text-foreground">{page.heading}</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {page.intro}
          </p>
        </header>

        {articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={content.pages.guides.emptyTitle}
            description={content.pages.guides.emptyDescription}
          />
        ) : (
          <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {articles.map((article) => {
              const isSeedCover = article.coverImageUrl?.startsWith("/images/seed/") ?? false;
              return (
                <article
                  key={article.id}
                  className="ma-card-elevate ma-card-lift-lg group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card"
                >
                  {article.coverImageUrl && (
                    <Link
                      href={`/guides/${article.slug}`}
                      className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-surface-2"
                    >
                      <Image
                        src={article.coverImageUrl}
                        alt={article.coverAltText ?? article.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className={
                          isSeedCover
                            ? "object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03] dark:brightness-90"
                            : "object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        }
                      />
                    </Link>
                  )}

                  <div className="flex flex-1 flex-col p-4 sm:p-5 md:p-6">
                    <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                      <span className="truncate">{article.authorName}</span>
                      {article.publishedAt && (
                        <>
                          <span aria-hidden="true" className="shrink-0">
                            ·
                          </span>
                          <time dateTime={article.publishedAt} className="shrink-0">
                            {formatDate(article.publishedAt)}
                          </time>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2.5 line-clamp-2 min-h-[2.75rem] text-lg leading-[1.25] font-semibold tracking-[-0.01em] text-text sm:min-h-[3.1rem] sm:text-xl">
                      <Link
                        href={`/guides/${article.slug}`}
                        className="rounded-sm underline-offset-4 hover:text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {article.title}
                      </Link>
                    </h2>

                    <p className="mt-2 line-clamp-3 flex-1 text-base leading-relaxed text-text-muted sm:text-sm">
                      {article.excerpt}
                    </p>

                    <div className="mt-6 border-t border-border pt-3">
                      <Link
                        href={`/guides/${article.slug}`}
                        className="ma-link-underline group/link inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <span>{content.pages.guides.readLabel}</span>
                        <ArrowRight
                          className="size-4 stroke-[1.5] transition-transform duration-150 ease-out group-hover/link:translate-x-1"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </RevealStagger>
        )}
      </Container>
    </Section>
  );
}
