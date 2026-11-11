import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { renderSafeMarkdown } from "@/lib/markdown";
import { resolvePublishedArticleBySlug } from "@/modules/articles/article.service";

interface GuideDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GuideDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolvePublishedArticleBySlug(slug);
  if (!resolved || resolved.kind !== "article") {
    return { title: "Diamond Guide" };
  }

  return {
    title: resolved.article.seoTitle ?? resolved.article.title,
    description: resolved.article.seoDescription ?? resolved.article.excerpt,
  };
}

async function GuideArticleBody({ params }: GuideDetailPageProps) {
  const { slug } = await params;
  const resolved = await resolvePublishedArticleBySlug(slug);

  if (!resolved) {
    notFound();
  }
  if (resolved.kind === "redirect") {
    permanentRedirect(`/guides/${resolved.newSlug}`);
  }

  const { article } = resolved;
  const bodyHtml = await renderSafeMarkdown(article.bodyMarkdown);

  return (
    <Section spacing="sm">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Guides", href: "/guides" },
              { label: article.title },
            ]}
          />

          <header className="mt-4 border-b border-border pb-6">
            <p className="font-sans text-editorial-label text-accent-text">Gemology Note</p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {article.excerpt}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Written by {article.authorName}</span>
              {article.publishedAt && (
                <>
                  <span>·</span>
                  <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                </>
              )}
            </div>
          </header>

          {article.coverImageUrl && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={article.coverImageUrl}
                alt={article.coverAltText ?? article.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          )}

          <article
            className="editorial-prose mt-8 space-y-5 text-sm leading-7 text-foreground/90 sm:text-base [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-medium [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card p-6">
            <div>
              <p className="font-display text-2xl font-medium text-foreground">
                Explore Pieces Mentioned in This Guide
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare GIA and IGI graded pieces directly in our collection or speak with a
                specialist.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {article.relatedCategorySlug && (
                <Button asChild>
                  <Link href={`/collections/${article.relatedCategorySlug}`} className="gap-1.5">
                    <span>Shop Collection</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/contact?type=PRODUCT">Ask a Gemologist</Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default function GuideDetailPage(props: GuideDetailPageProps) {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Loading guide…</div>
          </Container>
        </Section>
      }
    >
      <GuideArticleBody {...props} />
    </Suspense>
  );
}
