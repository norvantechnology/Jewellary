-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "articleSection" TEXT,
ADD COLUMN     "authorBio" TEXT,
ADD COLUMN     "authorCredentials" TEXT,
ADD COLUMN     "authorJobTitle" TEXT,
ADD COLUMN     "authorSameAs" JSONB,
ADD COLUMN     "canonicalOverride" TEXT,
ADD COLUMN     "noindex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ogDescription" TEXT,
ADD COLUMN     "ogImageUrl" TEXT,
ADD COLUMN     "ogTitle" TEXT,
ADD COLUMN     "seoFaqs" JSONB,
ADD COLUMN     "seoKeywords" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "canonicalOverride" TEXT,
ADD COLUMN     "noindex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ogDescription" TEXT,
ADD COLUMN     "ogImageUrl" TEXT,
ADD COLUMN     "ogTitle" TEXT,
ADD COLUMN     "seoFaqs" JSONB,
ADD COLUMN     "seoIntroCopy" TEXT,
ADD COLUMN     "seoIntroPosition" TEXT NOT NULL DEFAULT 'top',
ADD COLUMN     "seoKeywords" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ogDescription" TEXT,
ADD COLUMN     "ogTitle" TEXT,
ADD COLUMN     "salePriceEndAt" TIMESTAMP(3),
ADD COLUMN     "salePriceStartAt" TIMESTAMP(3),
ADD COLUMN     "seoFaqs" JSONB,
ADD COLUMN     "seoKeywords" TEXT,
ADD COLUMN     "warrantyText" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "avifUrl" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "copyrightNotice" TEXT,
ADD COLUMN     "creditText" TEXT,
ADD COLUMN     "jpegUrl" TEXT,
ADD COLUMN     "licenseUrl" TEXT,
ADD COLUMN     "responsiveVariants" JSONB,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "viewType" TEXT NOT NULL DEFAULT 'front';

-- AlterTable
ALTER TABLE "SlugRedirect" ADD COLUMN     "hits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastHitAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "seoSettings" JSONB,
ADD COLUMN     "seoTemplates" JSONB;

-- CreateTable
CREATE TABLE "redirect_rules" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirect_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "not_found_logs" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "not_found_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_facets" (
    "id" TEXT NOT NULL,
    "categoryPath" TEXT NOT NULL,
    "facetSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "introCopy" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "seoFaqs" JSONB,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageUrl" TEXT,
    "canonicalOverride" TEXT,
    "filterParams" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_facets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_page_seo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageUrl" TEXT,
    "canonicalOverride" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "seoFaqs" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_page_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_bot_hits" (
    "id" TEXT NOT NULL,
    "botName" TEXT NOT NULL,
    "botGroup" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 200,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_bot_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_audit_runs" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 100,
    "summary" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redirect_rules_fromPath_key" ON "redirect_rules"("fromPath");

-- CreateIndex
CREATE INDEX "redirect_rules_isActive_fromPath_idx" ON "redirect_rules"("isActive", "fromPath");

-- CreateIndex
CREATE UNIQUE INDEX "not_found_logs_path_key" ON "not_found_logs"("path");

-- CreateIndex
CREATE INDEX "not_found_logs_resolved_hits_idx" ON "not_found_logs"("resolved", "hits");

-- CreateIndex
CREATE INDEX "not_found_logs_lastSeenAt_idx" ON "not_found_logs"("lastSeenAt");

-- CreateIndex
CREATE INDEX "landing_facets_isActive_categoryPath_idx" ON "landing_facets"("isActive", "categoryPath");

-- CreateIndex
CREATE UNIQUE INDEX "landing_facets_categoryPath_facetSlug_key" ON "landing_facets"("categoryPath", "facetSlug");

-- CreateIndex
CREATE UNIQUE INDEX "static_page_seo_slug_key" ON "static_page_seo"("slug");

-- CreateIndex
CREATE INDEX "ai_bot_hits_botName_createdAt_idx" ON "ai_bot_hits"("botName", "createdAt");

-- CreateIndex
CREATE INDEX "ai_bot_hits_createdAt_idx" ON "ai_bot_hits"("createdAt");

-- CreateIndex
CREATE INDEX "seo_audit_runs_createdAt_idx" ON "seo_audit_runs"("createdAt");

