"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { submitIndexNowUrls } from "@/lib/seo/indexnow";
import { slugify } from "@/lib/slug";
import { articleUpsertSchema, deleteArticleSchema } from "@/modules/articles/article.schemas";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const upsertArticleAction = createAction(
  {
    name: "article.upsert",
    schema: articleUpsertSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "ARTICLE_UPSERT",
      entityType: "Article",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    const slug = input.slug?.trim() || slugify(input.title);
    const existing = input.id ? await db.article.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) {
      throw new NotFoundError("Article not found.");
    }

    const publishedAt = input.isPublished ? (existing?.publishedAt ?? new Date()) : null;

    if (existing && existing.slug !== slug) {
      await db.slugRedirect.upsert({
        where: { entityType_oldSlug: { entityType: "article", oldSlug: existing.slug } },
        update: { newSlug: slug },
        create: { entityType: "article", oldSlug: existing.slug, newSlug: slug },
      });
    }

    const data = {
      title: input.title,
      slug,
      excerpt: input.excerpt,
      bodyMarkdown: input.bodyMarkdown,
      coverImageUrl: input.coverImageUrl || null,
      coverAltText: input.coverAltText || null,
      authorName: input.authorName,
      authorJobTitle: input.authorJobTitle || null,
      authorCredentials: input.authorCredentials || null,
      authorBio: input.authorBio || null,
      authorSameAs:
        input.authorSameAs && input.authorSameAs.length > 0
          ? (input.authorSameAs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      articleSection: input.articleSection || null,
      isPublished: input.isPublished,
      publishedAt,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      seoKeywords: input.seoKeywords || null,
      seoFaqs:
        input.seoFaqs && input.seoFaqs.length > 0
          ? (input.seoFaqs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      ogTitle: input.ogTitle || null,
      ogDescription: input.ogDescription || null,
      ogImageUrl: input.ogImageUrl || null,
      canonicalOverride: input.canonicalOverride || null,
      noindex: input.noindex ?? false,
      relatedCategorySlug: input.relatedCategorySlug || null,
    };

    const article = input.id
      ? await db.article.update({ where: { id: input.id }, data })
      : await db.article.create({ data });

    updateTag(CACHE_TAGS.articles);
    updateTag(CACHE_TAGS.article(slug));
    revalidateTag(CACHE_TAGS.articles, "max");
    revalidateTag(CACHE_TAGS.article(slug), "max");
    revalidatePath(`/guides/${slug}`);
    revalidatePath("/guides");
    revalidatePath("/sitemap.xml");
    if (article.isPublished && !article.noindex) {
      void submitIndexNowUrls([`/guides/${article.slug}`, "/guides"]);
    }

    return { id: article.id, slug: article.slug };
  },
);

export const deleteArticleAction = createAction(
  {
    name: "article.delete",
    schema: deleteArticleSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "ARTICLE_DELETE",
      entityType: "Article",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const existing = await db.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Article not found.");

    await db.article.delete({ where: { id } });
    updateTag(CACHE_TAGS.articles);
    updateTag(CACHE_TAGS.article(existing.slug));
    revalidateTag(CACHE_TAGS.articles, "max");
    return { id };
  },
);
