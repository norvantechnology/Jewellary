import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container, Section } from "@/components/shared/primitives";
import { formatDate } from "@/lib/dates";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { INDEXABLE_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getPublishedArticles } from "@/modules/articles/article.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStoreSettings();
  return buildMetadata({
    title: "Diamond & Fine Jewellery Buying Guides",
    description:
      "Independent gemological guidance on diamond proportions, 4Cs clarity grading, 18K gold vs platinum alloys, and ring sizing.",
    pathname: "/guides",
    canonical: "/guides",
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: INDEXABLE_ROBOTS,
  });
}

export default async function GuidesIndexPage() {
  const articles = await getPublishedArticles();
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
  ]);

  return (
    <Section spacing="sm">
      <JsonLd data={breadcrumbJsonLd} />
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />

        <header className="mt-2 mb-10 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">Atelier Journal</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Diamond &amp; Fine Jewellery Guides
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Clear gemological notes written by our specialists to help you evaluate diamond cut,
            certification, metal durability, and ring sizing with confidence.
          </p>
        </header>

        {articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Editorial Guides Forthcoming"
            description="Our gemology notes are currently being prepared."
          />
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="group flex flex-col overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-accent"
              >
                {article.coverImageUrl && (
                  <Link
                    href={`/guides/${article.slug}`}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-muted"
                  >
                    <Image
                      src={article.coverImageUrl}
                      alt={article.coverAltText ?? article.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </Link>
                )}

                <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{article.authorName}</span>
                      {article.publishedAt && (
                        <>
                          <span>·</span>
                          <time dateTime={article.publishedAt}>
                            {formatDate(article.publishedAt)}
                          </time>
                        </>
                      )}
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-medium text-foreground">
                      <Link href={`/guides/${article.slug}`} className="hover:underline">
                        {article.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {article.excerpt}
                    </p>
                  </div>

                  <Link
                    href={`/guides/${article.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wider text-accent-text uppercase hover:underline"
                  >
                    <span>Read Full Article</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
