import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export interface ArticleDTO {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string | null;
  coverAltText: string | null;
  authorName: string;
  isPublished: boolean;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  relatedCategorySlug: string | null;
  updatedAt: string;
}

export async function listAllArticles(): Promise<ArticleDTO[]> {
  const rows = await db.article.findMany({
    orderBy: [{ updatedAt: "desc" }],
  });

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    bodyMarkdown: a.bodyMarkdown,
    coverImageUrl: a.coverImageUrl,
    coverAltText: a.coverAltText,
    authorName: a.authorName,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    relatedCategorySlug: a.relatedCategorySlug,
    updatedAt: a.updatedAt.toISOString(),
  }));
}

export async function getPublishedArticles(): Promise<ArticleDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.articles);

  const rows = await db.article.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    bodyMarkdown: a.bodyMarkdown,
    coverImageUrl: a.coverImageUrl,
    coverAltText: a.coverAltText,
    authorName: a.authorName,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    relatedCategorySlug: a.relatedCategorySlug,
    updatedAt: a.updatedAt.toISOString(),
  }));
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDTO | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.articles, CACHE_TAGS.article(slug));

  const a = await db.article.findFirst({
    where: { slug, isPublished: true },
  });
  if (!a) return null;

  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    bodyMarkdown: a.bodyMarkdown,
    coverImageUrl: a.coverImageUrl,
    coverAltText: a.coverAltText,
    authorName: a.authorName,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    relatedCategorySlug: a.relatedCategorySlug,
    updatedAt: a.updatedAt.toISOString(),
  };
}

export type ArticleResolutionResult =
  { kind: "article"; article: ArticleDTO } | { kind: "redirect"; newSlug: string } | null;

export async function resolvePublishedArticleBySlug(
  slug: string,
): Promise<ArticleResolutionResult> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.articles, CACHE_TAGS.article(slug));

  const article = await getPublishedArticleBySlug(slug);
  if (article) {
    return { kind: "article", article };
  }

  const redirect = await db.slugRedirect.findUnique({
    where: {
      entityType_oldSlug: {
        entityType: "article",
        oldSlug: slug,
      },
    },
  });

  if (redirect) {
    return { kind: "redirect", newSlug: redirect.newSlug };
  }

  return null;
}
