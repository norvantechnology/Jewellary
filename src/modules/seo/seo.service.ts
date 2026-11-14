import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import {
  computeProductSeoScore,
  detectRedirectLoopOrChain,
  normalizeRedirectPathInput,
} from "@/lib/seo/audit";
import { isDecorativePlaceholderUrl } from "@/lib/seo/images";
import { STATIC_INDEXABLE_ROUTES, getSiteUrl, toAbsoluteUrl } from "@/lib/seo/site";
import {
  finalizeSeoDescription,
  finalizeSeoTitle,
  interpolateSeoTemplate,
  mergeSeoTemplates,
  validateSeoCopy,
} from "@/lib/seo/templates";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface LandingFacetDTO {
  id: string;
  categoryPath: string;
  facetSlug: string;
  name: string;
  h1: string;
  introCopy: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoFaqs: SeoFaqItem[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalOverride: string | null;
  filterParams: {
    metal?: string[];
    shape?: string[];
    origin?: string[];
    certification?: string[];
    color?: string[];
    clarity?: string[];
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
  };
  isActive: boolean;
  noindex: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface StaticPageSeoDTO {
  id: string;
  slug: string;
  label: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalOverride: string | null;
  noindex: boolean;
  seoFaqs: SeoFaqItem[];
  updatedAt: string;
}

export interface RedirectRuleDTO {
  id: string;
  fromPath: string;
  toPath: string | null;
  statusCode: number;
  hits: number;
  lastHitAt: string | null;
  note: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface SlugRedirectDTO {
  id: string;
  entityType: string;
  oldSlug: string;
  newSlug: string;
  statusCode: number;
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
}

export function parseSeoFaqs(raw: unknown): SeoFaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const question = typeof obj.question === "string" ? obj.question.trim() : "";
      const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((entry): entry is SeoFaqItem => entry !== null);
}

export async function getActiveRedirectRulesForProxy(): Promise<
  Array<{ id: string; fromPath: string; toPath: string | null; statusCode: number }>
> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.redirects);

  return db.redirectRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
    },
  });
}

export async function resolveRedirectForPath(pathname: string): Promise<{
  id: string;
  toPath: string | null;
  statusCode: number;
  source: "rule" | "slug";
} | null> {
  const normalized = normalizeRedirectPathInput(pathname);
  const rules = await getActiveRedirectRulesForProxy();
  const matched = rules.find((r) => normalizeRedirectPathInput(r.fromPath) === normalized);
  if (matched) {
    return {
      id: matched.id,
      toPath: matched.toPath,
      statusCode: matched.statusCode,
      source: "rule",
    };
  }
  return null;
}

export async function recordRedirectRuleHit(id: string): Promise<void> {
  await db.redirectRule.update({
    where: { id },
    data: { hits: { increment: 1 }, lastHitAt: new Date() },
  });
}

export async function recordSlugRedirectHit(entityType: string, oldSlug: string): Promise<void> {
  await db.slugRedirect.updateMany({
    where: { entityType, oldSlug },
    data: { hits: { increment: 1 }, lastHitAt: new Date() },
  });
}

export async function recordNotFoundHit(input: {
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const cleanPath = normalizeRedirectPathInput(input.path).slice(0, 500);
  if (!cleanPath || cleanPath.startsWith("/_next") || cleanPath.startsWith("/api")) {
    return;
  }
  await db.notFoundLog.upsert({
    where: { path: cleanPath },
    update: {
      hits: { increment: 1 },
      lastSeenAt: new Date(),
      ...(input.referrer ? { referrer: input.referrer.slice(0, 500) } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent.slice(0, 250) } : {}),
      resolved: false,
    },
    create: {
      path: cleanPath,
      referrer: input.referrer?.slice(0, 500) ?? null,
      userAgent: input.userAgent?.slice(0, 250) ?? null,
      hits: 1,
    },
  });
}

export async function recordAiBotHit(input: {
  botName: string;
  botGroup: string;
  path: string;
  status?: number;
  referer?: string | null;
}): Promise<void> {
  await db.aiBotHit.create({
    data: {
      botName: input.botName.slice(0, 80),
      botGroup: input.botGroup.slice(0, 40),
      path: input.path.slice(0, 500),
      status: input.status ?? 200,
      referer: input.referer?.slice(0, 500) ?? null,
    },
  });
}

export async function getStaticPageSeo(slug: string): Promise<StaticPageSeoDTO | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.staticPages);

  const row = await db.staticPageSeo.findUnique({ where: { slug } });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoKeywords: row.seoKeywords,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageUrl: row.ogImageUrl,
    canonicalOverride: row.canonicalOverride,
    noindex: row.noindex,
    seoFaqs: parseSeoFaqs(row.seoFaqs),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAllStaticPageSeos(): Promise<StaticPageSeoDTO[]> {
  const existing = await db.staticPageSeo.findMany({ orderBy: { slug: "asc" } });
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  return STATIC_INDEXABLE_ROUTES.map((route) => {
    const found = bySlug.get(route.slug);
    return {
      id: found?.id ?? `virtual:${route.slug}`,
      slug: route.slug,
      label: found?.label ?? route.label,
      seoTitle: found?.seoTitle ?? null,
      seoDescription: found?.seoDescription ?? null,
      seoKeywords: found?.seoKeywords ?? null,
      ogTitle: found?.ogTitle ?? null,
      ogDescription: found?.ogDescription ?? null,
      ogImageUrl: found?.ogImageUrl ?? null,
      canonicalOverride: found?.canonicalOverride ?? null,
      noindex: found?.noindex ?? false,
      seoFaqs: found ? parseSeoFaqs(found.seoFaqs) : [],
      updatedAt: found?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    };
  });
}

function mapLandingFacetRow(row: {
  id: string;
  categoryPath: string;
  facetSlug: string;
  name: string;
  h1: string;
  introCopy: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoFaqs: Prisma.JsonValue | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalOverride: string | null;
  filterParams: Prisma.JsonValue;
  isActive: boolean;
  noindex: boolean;
  sortOrder: number;
  updatedAt: Date;
}): LandingFacetDTO {
  const fp =
    row.filterParams && typeof row.filterParams === "object" && !Array.isArray(row.filterParams)
      ? (row.filterParams as LandingFacetDTO["filterParams"])
      : {};

  return {
    id: row.id,
    categoryPath: row.categoryPath,
    facetSlug: row.facetSlug,
    name: row.name,
    h1: row.h1,
    introCopy: row.introCopy,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoKeywords: row.seoKeywords,
    seoFaqs: parseSeoFaqs(row.seoFaqs),
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageUrl: row.ogImageUrl,
    canonicalOverride: row.canonicalOverride,
    filterParams: fp,
    isActive: row.isActive,
    noindex: row.noindex,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getActiveLandingFacet(
  categoryPath: string,
  facetSlug: string,
): Promise<LandingFacetDTO | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.landingFacets);

  const row = await db.landingFacet.findFirst({
    where: {
      categoryPath: categoryPath.toLowerCase(),
      facetSlug: facetSlug.toLowerCase(),
      isActive: true,
    },
  });

  return row ? mapLandingFacetRow(row) : null;
}

export async function listActiveLandingFacetsForCategory(
  categoryPath: string,
): Promise<LandingFacetDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.landingFacets);

  const rows = await db.landingFacet.findMany({
    where: { categoryPath: categoryPath.toLowerCase(), isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map(mapLandingFacetRow);
}

export async function listSitemapLandingFacets(): Promise<
  Array<{ categoryPath: string; facetSlug: string; updatedAt: Date }>
> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.landingFacets);

  return db.landingFacet.findMany({
    where: { isActive: true, noindex: false },
    orderBy: [{ categoryPath: "asc" }, { sortOrder: "asc" }],
    select: {
      categoryPath: true,
      facetSlug: true,
      updatedAt: true,
    },
  });
}

export async function listAllLandingFacetsAdmin(): Promise<LandingFacetDTO[]> {
  const rows = await db.landingFacet.findMany({
    orderBy: [{ categoryPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(mapLandingFacetRow);
}

export async function listRedirectsAndNotFoundAdmin(): Promise<{
  rules: RedirectRuleDTO[];
  slugRedirects: SlugRedirectDTO[];
  notFoundLogs: Array<{
    id: string;
    path: string;
    referrer: string | null;
    userAgent: string | null;
    hits: number;
    firstSeenAt: string;
    lastSeenAt: string;
    resolved: boolean;
  }>;
}> {
  const [rules, slugRedirects, logs] = await Promise.all([
    db.redirectRule.findMany({ orderBy: [{ hits: "desc" }, { updatedAt: "desc" }] }),
    db.slugRedirect.findMany({ orderBy: [{ hits: "desc" }, { createdAt: "desc" }], take: 200 }),
    db.notFoundLog.findMany({
      orderBy: [{ resolved: "asc" }, { hits: "desc" }, { lastSeenAt: "desc" }],
      take: 200,
    }),
  ]);

  return {
    rules: rules.map((r) => ({
      id: r.id,
      fromPath: r.fromPath,
      toPath: r.toPath,
      statusCode: r.statusCode,
      hits: r.hits,
      lastHitAt: r.lastHitAt?.toISOString() ?? null,
      note: r.note,
      isActive: r.isActive,
      updatedAt: r.updatedAt.toISOString(),
    })),
    slugRedirects: slugRedirects.map((s) => ({
      id: s.id,
      entityType: s.entityType,
      oldSlug: s.oldSlug,
      newSlug: s.newSlug,
      statusCode: s.statusCode,
      hits: s.hits,
      lastHitAt: s.lastHitAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    notFoundLogs: logs.map((l) => ({
      id: l.id,
      path: l.path,
      referrer: l.referrer,
      userAgent: l.userAgent,
      hits: l.hits,
      firstSeenAt: l.firstSeenAt.toISOString(),
      lastSeenAt: l.lastSeenAt.toISOString(),
      resolved: l.resolved,
    })),
  };
}

export async function upsertRedirectRuleService(
  input: {
    id?: string;
    fromPath: string;
    toPath?: string | null;
    statusCode: number;
    note?: string | null;
    isActive: boolean;
  },
  actorId: string | null,
) {
  const fromPath = normalizeRedirectPathInput(input.fromPath);
  const toPath =
    input.statusCode === 410 || !input.toPath ? null : normalizeRedirectPathInput(input.toPath);

  const existingAll = await db.redirectRule.findMany({
    where: { isActive: true },
    select: { fromPath: true, toPath: true },
  });
  const map = new Map<string, string | null>(
    existingAll.map((r) => [normalizeRedirectPathInput(r.fromPath), r.toPath]),
  );
  map.set(fromPath, toPath);

  const chainCheck = detectRedirectLoopOrChain(fromPath, toPath, map);
  if (chainCheck.hasLoop) {
    throw new ConflictError(
      `Redirect loop detected involving "${fromPath}" -> "${toPath ?? ""}". Resolve the cycle first.`,
    );
  }

  const finalTarget =
    chainCheck.chainLength > 1 && chainCheck.finalTarget ? chainCheck.finalTarget : toPath;

  const data = {
    fromPath,
    toPath: finalTarget,
    statusCode: input.statusCode,
    note: input.note?.trim() || null,
    isActive: input.isActive,
    ...(input.id ? {} : { createdById: actorId }),
  };

  const saved = input.id
    ? await db.redirectRule.update({ where: { id: input.id }, data })
    : await db.redirectRule.upsert({
        where: { fromPath },
        update: data,
        create: data,
      });

  await db.notFoundLog.updateMany({
    where: { path: fromPath },
    data: { resolved: true },
  });

  return saved;
}

export async function importRedirectRulesCsvService(csvText: string, actorId: string | null) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let imported = 0;
  const skipped: string[] = [];

  for (const [idx, rawLine] of lines.entries()) {
    if (idx === 0 && /^from/i.test(rawLine)) continue;
    const cols = rawLine.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const fromRaw = cols[0];
    const toRaw = cols[1] || null;
    const codeRaw = Number(cols[2] || "301");
    const statusCode = [301, 302, 307, 308, 410].includes(codeRaw) ? codeRaw : 301;
    const note = cols[3] || "CSV import";

    if (!fromRaw || !fromRaw.startsWith("/")) {
      skipped.push(rawLine.slice(0, 60));
      continue;
    }

    try {
      await upsertRedirectRuleService(
        {
          fromPath: fromRaw,
          toPath: statusCode === 410 ? null : toRaw,
          statusCode,
          note,
          isActive: true,
        },
        actorId,
      );
      imported += 1;
    } catch {
      skipped.push(rawLine.slice(0, 60));
    }
  }

  return { imported, skipped };
}

export interface BulkSeoItemDTO {
  entityType: "product" | "category" | "article";
  id: string;
  name: string;
  slug: string;
  url: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  canonicalOverride: string | null;
  noindex: boolean;
  resolvedTitle: string;
  resolvedDescription: string;
  score: number;
  issuesCount: number;
}

export async function listBulkSeoItems(): Promise<BulkSeoItemDTO[]> {
  const [settings, products, categories, articles] = await Promise.all([
    getPublicStoreSettings(),
    db.product.findMany({
      where: { deletedAt: null },
      orderBy: [{ updatedAt: "desc" }],
      take: 250,
      include: {
        category: { select: { name: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 6 },
      },
    }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    db.article.findMany({ orderBy: [{ updatedAt: "desc" }] }),
  ]);

  const templates = mergeSeoTemplates(settings.seoTemplates);
  const items: BulkSeoItemDTO[] = [];

  for (const p of products) {
    const resolvedTitle = finalizeSeoTitle(
      p.seoTitle?.trim() ||
        interpolateSeoTemplate(templates.productTitle, {
          name: p.name,
          category: p.category.name,
          collection: p.category.name,
          metal: p.metalType ?? p.stoneShape,
          carat: p.caratTotal?.toString(),
          cert: p.certificationLab ? `${p.certificationLab} Certified` : null,
          brand: settings.storeName,
        }),
      { brandName: settings.storeName },
    );
    const resolvedDescription = finalizeSeoDescription(
      p.seoDescription?.trim() || p.subtitle || p.description || p.name,
      `${p.certificationLab ?? "GIA / IGI"} certified fine jewelry from ${settings.storeName}.`,
    );
    const scoreRes = computeProductSeoScore({
      name: p.name,
      slug: p.slug,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      resolvedTitle,
      resolvedDescription,
      seoKeywords: p.seoKeywords,
      primaryImageUrl: p.images[0]?.url,
      primaryImageWidth: p.images[0]?.width,
      primaryImageHeight: p.images[0]?.height,
      primaryAltText: p.images[0]?.altText,
      imageCount: p.images.length,
      hasSpecs: Boolean(p.metalType || p.caratTotal || p.certificationLab),
    });

    items.push({
      entityType: "product",
      id: p.id,
      name: p.name,
      slug: p.slug,
      url: `/products/${p.slug}`,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      seoKeywords: p.seoKeywords,
      canonicalOverride: p.canonicalOverride,
      noindex: p.noindex,
      resolvedTitle,
      resolvedDescription,
      score: scoreRes.score,
      issuesCount: scoreRes.items.filter((i) => !i.passed).length,
    });
  }

  for (const c of categories) {
    const resolvedTitle = finalizeSeoTitle(
      c.seoTitle?.trim() ||
        interpolateSeoTemplate(templates.collectionTitle, {
          name: c.name,
          collection: c.name,
          brand: settings.storeName,
        }),
      { brandName: settings.storeName },
    );
    const resolvedDescription = finalizeSeoDescription(
      c.seoDescription?.trim() || c.description || c.name,
      `Explore ${c._count.products} ${c.name} designs with moissanite and lab-grown diamonds, handmade to order.`,
    );
    const textIssues = validateSeoCopy({
      name: c.name,
      slug: c.slug,
      title: resolvedTitle,
      description: resolvedDescription,
    });
    const hasEmptyWarning = c._count.products === 0 ? 1 : 0;

    items.push({
      entityType: "category",
      id: c.id,
      name: c.name,
      slug: c.path,
      url: `/collections/${c.path}`,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      seoKeywords: c.seoKeywords,
      canonicalOverride: c.canonicalOverride,
      noindex: c.noindex,
      resolvedTitle,
      resolvedDescription,
      score: Math.max(40, 100 - textIssues.length * 15 - hasEmptyWarning * 20),
      issuesCount: textIssues.length + hasEmptyWarning,
    });
  }

  for (const a of articles) {
    const resolvedTitle = finalizeSeoTitle(
      a.seoTitle?.trim() || `${a.title} | ${settings.storeName}`,
      {
        brandName: settings.storeName,
      },
    );
    const resolvedDescription = finalizeSeoDescription(a.seoDescription?.trim() || a.excerpt);
    const textIssues = validateSeoCopy({
      name: a.title,
      slug: a.slug,
      title: resolvedTitle,
      description: resolvedDescription,
    });

    items.push({
      entityType: "article",
      id: a.id,
      name: a.title,
      slug: a.slug,
      url: `/guides/${a.slug}`,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      seoKeywords: a.seoKeywords,
      canonicalOverride: a.canonicalOverride,
      noindex: a.noindex,
      resolvedTitle,
      resolvedDescription,
      score: Math.max(40, 100 - textIssues.length * 15),
      issuesCount: textIssues.length,
    });
  }

  return items;
}

export interface AuditIssueRecord {
  url: string;
  entityType: string;
  entityId: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export async function runAndSaveSeoAudit(
  triggeredBy: string | null,
  options?: { checkImagesHttp?: boolean },
) {
  const [settings, products, categories, articles, facets, rules, notFoundCount] =
    await Promise.all([
      getPublicStoreSettings(),
      db.product.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        include: {
          category: { select: { name: true, isActive: true } },
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      }),
      db.category.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
        },
      }),
      db.article.findMany({ where: { isPublished: true } }),
      db.landingFacet.findMany({ where: { isActive: true } }),
      db.redirectRule.findMany({ where: { isActive: true } }),
      db.notFoundLog.count({ where: { resolved: false } }),
    ]);

  const templates = mergeSeoTemplates(settings.seoTemplates);
  const issues: AuditIssueRecord[] = [];
  const seenTitles = new Map<string, string>();
  const seenDescriptions = new Map<string, string>();
  const imageUrlsToCheck = new Set<string>();

  let totalUrls = STATIC_INDEXABLE_ROUTES.length;
  let passedCount = STATIC_INDEXABLE_ROUTES.length;

  for (const p of products) {
    totalUrls += 1;
    const url = `/products/${p.slug}`;
    const resolvedTitle = finalizeSeoTitle(
      p.seoTitle?.trim() ||
        interpolateSeoTemplate(templates.productTitle, {
          name: p.name,
          category: p.category.name,
          collection: p.category.name,
          metal: p.metalType ?? p.stoneShape,
          carat: p.caratTotal?.toString(),
          cert: p.certificationLab ? `${p.certificationLab} Certified` : null,
          brand: settings.storeName,
        }),
      { brandName: settings.storeName },
    );
    const resolvedDescription = finalizeSeoDescription(
      p.seoDescription?.trim() || p.subtitle || p.description || p.name,
      `${p.certificationLab ?? "GIA / IGI"} certified fine jewelry made by ${settings.storeName}.`,
    );

    const prevTitleUrl = seenTitles.get(resolvedTitle.toLowerCase());
    if (prevTitleUrl) {
      issues.push({
        url,
        entityType: "product",
        entityId: p.id,
        severity: "error",
        code: "DUPLICATE_TITLE",
        message: `Duplicate title with ${prevTitleUrl}: "${resolvedTitle}"`,
      });
    } else {
      seenTitles.set(resolvedTitle.toLowerCase(), url);
    }

    const prevDescUrl = seenDescriptions.get(resolvedDescription.toLowerCase());
    if (prevDescUrl) {
      issues.push({
        url,
        entityType: "product",
        entityId: p.id,
        severity: "warning",
        code: "DUPLICATE_DESCRIPTION",
        message: `Duplicate description with ${prevDescUrl}.`,
      });
    } else {
      seenDescriptions.set(resolvedDescription.toLowerCase(), url);
    }

    const scoreRes = computeProductSeoScore({
      name: p.name,
      slug: p.slug,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      resolvedTitle,
      resolvedDescription,
      seoKeywords: p.seoKeywords,
      primaryImageUrl: p.images[0]?.url,
      primaryImageWidth: p.images[0]?.width,
      primaryImageHeight: p.images[0]?.height,
      primaryAltText: p.images[0]?.altText,
      imageCount: p.images.length,
      hasSpecs: Boolean(p.metalType || p.caratTotal || p.certificationLab),
    });

    const failing = scoreRes.items.filter((i) => !i.passed);
    if (failing.length === 0) {
      passedCount += 1;
    } else {
      for (const item of failing) {
        issues.push({
          url,
          entityType: "product",
          entityId: p.id,
          severity: item.severity === "error" ? "error" : "warning",
          code: item.id.toUpperCase(),
          message: `${item.label}: ${item.detail}`,
        });
      }
    }

    for (const img of p.images) {
      if (!isDecorativePlaceholderUrl(img.url)) {
        imageUrlsToCheck.add(toAbsoluteUrl(img.url));
      }
    }
  }

  for (const cat of categories) {
    totalUrls += 1;
    const url = `/collections/${cat.path}`;
    if (cat._count.products === 0 && !cat.noindex) {
      issues.push({
        url,
        entityType: "category",
        entityId: cat.id,
        severity: "warning",
        code: "EMPTY_COLLECTION",
        message: "Category has 0 active products (automatically noindexed & omitted from sitemap).",
      });
    } else {
      passedCount += 1;
    }
  }

  for (const facet of facets) {
    totalUrls += 1;
    passedCount += 1;
    const url = `/collections/${facet.categoryPath}/${facet.facetSlug}`;
    const copyIssues = validateSeoCopy({
      name: facet.name,
      slug: facet.facetSlug,
      title: facet.seoTitle ?? facet.h1,
      description: facet.seoDescription ?? facet.introCopy ?? facet.name,
    });
    for (const ci of copyIssues) {
      if (ci.code === "PLACEHOLDER_OR_TEST_TOKEN") {
        issues.push({
          url,
          entityType: "landing-facet",
          entityId: facet.id,
          severity: "error",
          code: ci.code,
          message: ci.message,
        });
      }
    }
  }

  for (const article of articles) {
    totalUrls += 1;
    const url = `/guides/${article.slug}`;
    if (!article.authorCredentials) {
      issues.push({
        url,
        entityType: "article",
        entityId: article.id,
        severity: "warning",
        code: "MISSING_EEAT_CREDENTIALS",
        message:
          "Add author gemology credentials / job title to strengthen E-E-A-T Article schema.",
      });
    } else {
      passedCount += 1;
    }
  }

  const ruleMap = new Map<string, string | null>(
    rules.map((r) => [normalizeRedirectPathInput(r.fromPath), r.toPath]),
  );
  for (const r of rules) {
    const check = detectRedirectLoopOrChain(r.fromPath, r.toPath, ruleMap);
    if (check.hasLoop || check.chainLength > 1) {
      issues.push({
        url: r.fromPath,
        entityType: "redirect",
        entityId: r.id,
        severity: check.hasLoop ? "error" : "warning",
        code: check.hasLoop ? "REDIRECT_LOOP" : "REDIRECT_CHAIN",
        message: check.hasLoop
          ? `Redirect loop detected starting at ${r.fromPath}.`
          : `Redirect chain (${check.chainLength} hops) from ${r.fromPath}.`,
      });
    }
  }

  if (notFoundCount > 0) {
    issues.push({
      url: "/admin/seo?tab=redirects",
      entityType: "404-log",
      entityId: "not-found",
      severity: "warning",
      code: "UNRESOLVED_404_URLS",
      message: `${notFoundCount} unresolved 404 URL(s) logged awaiting redirect or 410 review.`,
    });
  }

  // Optional live HTTP HEAD verification of product images
  let checkedImageCount = 0;
  let brokenImageCount = 0;
  if (options?.checkImagesHttp) {
    const siteOrigin = getSiteUrl();
    const list = Array.from(imageUrlsToCheck).slice(0, 60);
    for (const imgUrl of list) {
      if (!imgUrl.startsWith("http")) continue;
      // Only probe non-local URLs when network reachable
      if (imgUrl.startsWith(siteOrigin) && process.env.NODE_ENV !== "production") continue;
      checkedImageCount += 1;
      try {
        const res = await fetch(imgUrl, { method: "HEAD", signal: AbortSignal.timeout(2500) });
        if (!res.ok) {
          brokenImageCount += 1;
          issues.push({
            url: imgUrl,
            entityType: "image",
            entityId: imgUrl,
            severity: "error",
            code: "BROKEN_IMAGE_URL",
            message: `Image URL returned HTTP ${res.status}.`,
          });
        }
      } catch {
        brokenImageCount += 1;
        issues.push({
          url: imgUrl,
          entityType: "image",
          entityId: imgUrl,
          severity: "warning",
          code: "UNREACHABLE_IMAGE_URL",
          message: "Timed out or unreachable during image HEAD check.",
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, Math.min(100, 100 - errorCount * 8 - warningCount * 2));

  const summary = {
    totalUrls,
    activeProducts: products.length,
    activeCategories: categories.length,
    landingFacets: facets.length,
    publishedArticles: articles.length,
    activeRedirects: rules.length,
    unresolved404s: notFoundCount,
    checkedImageCount,
    brokenImageCount,
    siteUrl: getSiteUrl(),
    indexNowConfigured: Boolean(settings.seoSettings?.indexNowKey),
    aiCrawlersAllowed: settings.allowAiCrawlers,
  };

  return db.seoAuditRun.create({
    data: {
      triggeredBy,
      totalUrls,
      passedCount,
      warningCount,
      errorCount,
      score,
      summary: summary as unknown as Prisma.InputJsonValue,
      issues: issues as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getSeoDashboardSnapshot() {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const [recentAudits, aiHitsRaw, landingFacets, staticPages, redirectsData, bulkItems] =
    await Promise.all([
      db.seoAuditRun.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      db.aiBotHit.groupBy({
        by: ["botName", "botGroup"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      listAllLandingFacetsAdmin(),
      listAllStaticPageSeos(),
      listRedirectsAndNotFoundAdmin(),
      listBulkSeoItems(),
    ]);

  return {
    latestAudit: recentAudits[0] ?? null,
    auditHistory: recentAudits,
    aiBotSummary: aiHitsRaw.map((row) => ({
      botName: row.botName,
      botGroup: row.botGroup,
      hitsLast30d: row._count._all,
    })),
    landingFacets,
    staticPages,
    redirects: redirectsData,
    bulkItems,
  };
}

export async function validateNotFoundOrThrow(id: string) {
  const exists = await db.redirectRule.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError("Redirect rule not found.");
  return exists;
}

export async function assertCleanLandingFacet(categoryPath: string) {
  const cat = await db.category.findUnique({ where: { path: categoryPath } });
  if (!cat) {
    throw new ValidationError(`Category path "${categoryPath}" does not exist.`);
  }
  return cat;
}
