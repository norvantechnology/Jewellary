"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { submitIndexNowUrls } from "@/lib/seo/indexnow";
import {
  bulkSeoBatchSchema,
  deleteByIdSchema,
  globalSeoConfigUpdateSchema,
  landingFacetUpsertSchema,
  redirectCsvImportSchema,
  redirectRuleUpsertSchema,
  runSeoAuditSchema,
  seoTemplatesUpdateSchema,
  staticPageSeoUpsertSchema,
} from "@/modules/seo/seo.schemas";
import { invalidateRedirectLookupCache } from "@/modules/seo/redirect-lookup";
import {
  assertCleanLandingFacet,
  importRedirectRulesCsvService,
  runAndSaveSeoAudit,
  upsertRedirectRuleService,
} from "@/modules/seo/seo.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteImagesIfUnused } from "@/server/image-cleanup";
import { z } from "zod";

function invalidateTags(tags: string[], paths: string[] = []) {
  if (tags.includes(CACHE_TAGS.redirects)) {
    invalidateRedirectLookupCache();
  }
  for (const tag of tags) {
    updateTag(tag);
    revalidateTag(tag, "max");
  }
  for (const p of paths) {
    revalidatePath(p);
  }
}

export const upsertRedirectRuleAction = createAction(
  {
    name: "seo.redirect.upsert",
    schema: redirectRuleUpsertSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_REDIRECT_UPSERT",
      entityType: "RedirectRule",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input, ctx) => {
    const saved = await upsertRedirectRuleService(input, ctx.auth?.user.id ?? null);
    invalidateTags([CACHE_TAGS.redirects]);
    return { id: saved.id, fromPath: saved.fromPath, toPath: saved.toPath };
  },
);

export const deleteRedirectRuleAction = createAction(
  {
    name: "seo.redirect.delete",
    schema: deleteByIdSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_REDIRECT_DELETE",
      entityType: "RedirectRule",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const existing = await db.redirectRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Redirect rule not found.");
    await db.redirectRule.delete({ where: { id } });
    invalidateTags([CACHE_TAGS.redirects]);
    return { id };
  },
);

export const importRedirectsCsvAction = createAction(
  {
    name: "seo.redirect.importCsv",
    schema: redirectCsvImportSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_REDIRECT_CSV_IMPORT",
      entityType: "RedirectRule",
      entityId: () => "csv-import",
    },
  },
  async ({ csvText }, ctx) => {
    const res = await importRedirectRulesCsvService(csvText, ctx.auth?.user.id ?? null);
    invalidateTags([CACHE_TAGS.redirects]);
    return res;
  },
);

export const resolveNotFoundLogAction = createAction(
  {
    name: "seo.notFound.resolve",
    schema: deleteByIdSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_404_RESOLVE",
      entityType: "NotFoundLog",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    await db.notFoundLog.update({ where: { id }, data: { resolved: true } });
    return { id };
  },
);

export const upsertLandingFacetAction = createAction(
  {
    name: "seo.landingFacet.upsert",
    schema: landingFacetUpsertSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_LANDING_FACET_UPSERT",
      entityType: "LandingFacet",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    await assertCleanLandingFacet(input.categoryPath);
    const data = {
      categoryPath: input.categoryPath,
      facetSlug: input.facetSlug,
      name: input.name,
      h1: input.h1,
      introCopy: input.introCopy || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      seoKeywords: input.seoKeywords || null,
      seoFaqs:
        input.seoFaqs.length > 0
          ? (input.seoFaqs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      ogTitle: input.ogTitle || null,
      ogDescription: input.ogDescription || null,
      ogImageUrl: input.ogImageUrl || null,
      canonicalOverride: input.canonicalOverride || null,
      filterParams: input.filterParams as unknown as Prisma.InputJsonValue,
      isActive: input.isActive,
      noindex: input.noindex,
      sortOrder: input.sortOrder,
    };

    const saved = input.id
      ? await db.landingFacet.update({ where: { id: input.id }, data })
      : await db.landingFacet.upsert({
          where: {
            categoryPath_facetSlug: {
              categoryPath: input.categoryPath,
              facetSlug: input.facetSlug,
            },
          },
          update: data,
          create: data,
        });

    const facetUrl = `/collections/${saved.categoryPath}/${saved.facetSlug}`;
    invalidateTags(
      [CACHE_TAGS.landingFacets, CACHE_TAGS.categories],
      [facetUrl, `/collections/${saved.categoryPath}`, "/sitemap.xml"],
    );
    if (saved.isActive && !saved.noindex) {
      void submitIndexNowUrls([facetUrl]);
    }
    return { id: saved.id, url: facetUrl };
  },
);

export const deleteLandingFacetAction = createAction(
  {
    name: "seo.landingFacet.delete",
    schema: deleteByIdSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_LANDING_FACET_DELETE",
      entityType: "LandingFacet",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const existing = await db.landingFacet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Landing facet not found.");
    await db.landingFacet.delete({ where: { id } });
    await deleteImagesIfUnused(
      [existing.imageUrl, existing.ogImageUrl].filter((u): u is string => !!u),
    );
    invalidateTags([CACHE_TAGS.landingFacets], [`/collections/${existing.categoryPath}`]);
    return { id };
  },
);

/** Sets or clears the "Shop by shape" thumbnail of a landing page; the old file is removed. */
export const setLandingFacetImageAction = createAction(
  {
    name: "seo.landingFacet.setImage",
    schema: z
      .object({
        id: z.string().trim().min(1).max(64),
        imageUrl: z.string().trim().max(500).nullable(),
      })
      .strict(),
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_LANDING_FACET_IMAGE",
      entityType: "LandingFacet",
      entityId: (input) => input.id,
    },
  },
  async ({ id, imageUrl }) => {
    const existing = await db.landingFacet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Shape page not found.");
    await db.landingFacet.update({ where: { id }, data: { imageUrl: imageUrl || null } });
    if (existing.imageUrl && existing.imageUrl !== imageUrl) {
      await deleteImagesIfUnused([existing.imageUrl]);
    }
    invalidateTags(
      [CACHE_TAGS.landingFacets],
      ["/", `/collections/${existing.categoryPath}/${existing.facetSlug}`],
    );
    return { id, imageUrl: imageUrl || null };
  },
);

export const upsertStaticPageSeoAction = createAction(
  {
    name: "seo.staticPage.upsert",
    schema: staticPageSeoUpsertSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_STATIC_PAGE_UPSERT",
      entityType: "StaticPageSeo",
      entityId: (_input, res: { slug: string }) => res.slug,
    },
  },
  async (input) => {
    const data = {
      slug: input.slug,
      label: input.label,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      seoKeywords: input.seoKeywords || null,
      ogTitle: input.ogTitle || null,
      ogDescription: input.ogDescription || null,
      ogImageUrl: input.ogImageUrl || null,
      canonicalOverride: input.canonicalOverride || null,
      noindex: input.noindex,
      seoFaqs:
        input.seoFaqs.length > 0
          ? (input.seoFaqs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    };

    const saved = await db.staticPageSeo.upsert({
      where: { slug: input.slug },
      update: data,
      create: data,
    });

    const pagePath = input.slug === "/" ? "/" : `/${input.slug}`;
    invalidateTags([CACHE_TAGS.staticPages], [pagePath, "/sitemap.xml"]);
    if (!input.noindex) {
      void submitIndexNowUrls([pagePath]);
    }
    return { slug: saved.slug };
  },
);

export const updateSeoTemplatesAction = createAction(
  {
    name: "seo.templates.update",
    schema: seoTemplatesUpdateSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_TEMPLATES_UPDATE",
      entityType: "StoreSetting",
      entityId: () => "default",
    },
  },
  async (input) => {
    await db.storeSetting.update({
      where: { id: "default" },
      data: {
        seoTemplates: input as unknown as Prisma.InputJsonValue,
      },
    });
    invalidateTags([CACHE_TAGS.settings, CACHE_TAGS.products, CACHE_TAGS.categories]);
    return { ok: true };
  },
);

export const updateGlobalSeoConfigAction = createAction(
  {
    name: "seo.globalConfig.update",
    schema: globalSeoConfigUpdateSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_GLOBAL_CONFIG_UPDATE",
      entityType: "StoreSetting",
      entityId: () => "default",
    },
  },
  async (input) => {
    const seoSettingsPayload = {
      canonicalHost: input.canonicalHost || null,
      trailingSlashPolicy: input.trailingSlashPolicy,
      maintenanceMode: input.maintenanceMode,
      maintenanceRetryAfterSeconds: input.maintenanceRetryAfterSeconds,
      googleSiteVerification: input.googleSiteVerification || null,
      bingSiteVerification: input.bingSiteVerification || null,
      pinterestVerification: input.pinterestVerification || null,
      indexNowKey: input.indexNowKey || null,
      indexNowEnabled: input.indexNowEnabled,
      defaultTwitterHandle: input.defaultTwitterHandle || null,
      defaultGoogleProductCategory: input.defaultGoogleProductCategory || null,
      customRobotsDisallow: input.customRobotsDisallow,
      aiVisibilityChecklist: input.aiVisibilityChecklist,
    };

    await db.storeSetting.update({
      where: { id: "default" },
      data: {
        legalName: input.legalName || null,
        seoDefaultTitlePattern: input.seoDefaultTitlePattern || null,
        seoDefaultDescription: input.seoDefaultDescription || null,
        defaultOgImageUrl: input.defaultOgImageUrl || null,
        allowAiCrawlers: input.allowAiCrawlers,
        seoSettings: seoSettingsPayload as unknown as Prisma.InputJsonValue,
      },
    });

    invalidateTags([CACHE_TAGS.settings], ["/robots.txt", "/sitemap.xml", "/llms.txt"]);
    return { ok: true };
  },
);

export const updateBulkSeoBatchAction = createAction(
  {
    name: "seo.bulk.update",
    schema: bulkSeoBatchSchema,
    auth: { permission: "catalog:write" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_BULK_UPDATE",
      entityType: "BulkSeo",
      entityId: () => "batch",
    },
  },
  async ({ updates }) => {
    const changedUrls: string[] = [];

    await db.$transaction(async (tx) => {
      for (const row of updates) {
        const payload = {
          seoTitle: row.seoTitle || null,
          seoDescription: row.seoDescription || null,
          seoKeywords: row.seoKeywords || null,
          canonicalOverride: row.canonicalOverride || null,
          noindex: row.noindex,
        };
        if (row.entityType === "product") {
          const p = await tx.product.update({
            where: { id: row.id },
            data: payload,
            select: { slug: true },
          });
          changedUrls.push(`/products/${p.slug}`);
        } else if (row.entityType === "category") {
          const c = await tx.category.update({
            where: { id: row.id },
            data: payload,
            select: { path: true },
          });
          changedUrls.push(`/collections/${c.path}`);
        } else {
          const a = await tx.article.update({
            where: { id: row.id },
            data: payload,
            select: { slug: true },
          });
          changedUrls.push(`/guides/${a.slug}`);
        }
      }
    });

    invalidateTags(
      [CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.articles],
      [...changedUrls, "/sitemap.xml"],
    );
    void submitIndexNowUrls(changedUrls);
    return { updatedCount: updates.length };
  },
);

export const runSeoAuditAction = createAction(
  {
    name: "seo.audit.run",
    schema: runSeoAuditSchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "SEO_AUDIT_RUN",
      entityType: "SeoAuditRun",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input, ctx) => {
    const run = await runAndSaveSeoAudit(ctx.auth?.user.id ?? null, input);
    return {
      id: run.id,
      score: run.score,
      errorCount: run.errorCount,
      warningCount: run.warningCount,
      totalUrls: run.totalUrls,
    };
  },
);
