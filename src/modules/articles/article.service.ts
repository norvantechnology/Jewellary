import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { parseSeoFaqs, type SeoFaqItem } from "@/modules/seo/seo.service";
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
  authorJobTitle: string | null;
  authorCredentials: string | null;
  authorBio: string | null;
  authorSameAs: string[];
  articleSection: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoFaqs: SeoFaqItem[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalOverride: string | null;
  noindex: boolean;
  relatedCategorySlug: string | null;
  updatedAt: string;
}

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
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
    authorJobTitle: a.authorJobTitle,
    authorCredentials: a.authorCredentials,
    authorBio: a.authorBio,
    authorSameAs: parseStringArray(a.authorSameAs),
    articleSection: a.articleSection,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    seoKeywords: a.seoKeywords,
    seoFaqs: parseSeoFaqs(a.seoFaqs),
    ogTitle: a.ogTitle,
    ogDescription: a.ogDescription,
    ogImageUrl: a.ogImageUrl,
    canonicalOverride: a.canonicalOverride,
    noindex: a.noindex,
    relatedCategorySlug: a.relatedCategorySlug,
    updatedAt: a.updatedAt.toISOString(),
  }));
}

export async function getPublishedArticles(limit?: number): Promise<ArticleDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.articles);

  const rows = await db.article.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    ...(typeof limit === "number" && limit > 0 ? { take: limit } : {}),
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImageUrl: true,
      coverAltText: true,
      authorName: true,
      authorJobTitle: true,
      authorCredentials: true,
      authorBio: true,
      authorSameAs: true,
      articleSection: true,
      isPublished: true,
      publishedAt: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      seoFaqs: true,
      ogTitle: true,
      ogDescription: true,
      ogImageUrl: true,
      canonicalOverride: true,
      noindex: true,
      relatedCategorySlug: true,
      updatedAt: true,
    },
  });

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    bodyMarkdown: "",
    coverImageUrl: a.coverImageUrl,
    coverAltText: a.coverAltText,
    authorName: a.authorName,
    authorJobTitle: a.authorJobTitle,
    authorCredentials: a.authorCredentials,
    authorBio: a.authorBio,
    authorSameAs: parseStringArray(a.authorSameAs),
    articleSection: a.articleSection,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    seoKeywords: a.seoKeywords,
    seoFaqs: parseSeoFaqs(a.seoFaqs),
    ogTitle: a.ogTitle,
    ogDescription: a.ogDescription,
    ogImageUrl: a.ogImageUrl,
    canonicalOverride: a.canonicalOverride,
    noindex: a.noindex,
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
    authorJobTitle: a.authorJobTitle,
    authorCredentials: a.authorCredentials,
    authorBio: a.authorBio,
    authorSameAs: parseStringArray(a.authorSameAs),
    articleSection: a.articleSection,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    seoKeywords: a.seoKeywords,
    seoFaqs: parseSeoFaqs(a.seoFaqs),
    ogTitle: a.ogTitle,
    ogDescription: a.ogDescription,
    ogImageUrl: a.ogImageUrl,
    canonicalOverride: a.canonicalOverride,
    noindex: a.noindex,
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
