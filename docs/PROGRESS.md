# Progress Log

Tracking phase-by-phase execution against `PROJECT_REQUIREMENTS.md`.

---

## Phase 0 — Foundation (Completed)

- **Built:** Repository config, `package.json` (Next.js 16.4.6, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind CSS v4, Prisma 7, Better Auth 1.7, Zod v4), `next.config.ts` (`standalone`, `cacheComponents`, `partialPrefetching`, `reactCompiler`, security headers, remote image patterns), `eslint.config.mjs` (Next core-web-vitals + TypeScript + jsx-a11y + custom `design-tokens/no-raw-hex` & no-blue/purple rule), Prettier, Husky + commitlint, `docker-compose.yml`, `Dockerfile`, `.github/workflows/ci.yml`, `.env.example`, `src/lib/env.ts`, `src/lib/money.ts`, `src/lib/slug.ts`, `src/lib/format.ts`, `src/lib/dates.ts`, `src/lib/permissions.ts`, `src/server/logger.ts`, `src/server/errors.ts`, `src/server/cache-tags.ts`, `src/instrumentation.ts`, `src/app/api/health/route.ts`, `tests/unit/foundation.test.ts`.
- **Verified against Next.js bundled docs (`node_modules/next/dist/docs`):** `cacheComponents` + `partialPrefetching`, `src/proxy.ts` convention, `next/image` `preload`, `revalidateTag(tag, 'max')` / `updateTag`, `generateSitemaps` async `id`.
- **Gate passed:** `tsc --noEmit`, `eslint .`, `prettier --check`, `vitest` (9/9 unit tests), `next build`, PostgreSQL 16 + Redis Docker containers healthy.
- **Next:** Phase 1 — Design System & Global Shell.

---

## Phase 1 — Design System & Global Shell (Completed)

- **Built:** Four-layer token CSS architecture (`src/styles/tokens.css`, `theme.css`, `base.css`, `utilities.css`, `src/app/globals.css`) with complete warm champagne/ivory/beige/gold/bronze/charcoal light & dark themes (zero blue/purple, WCAG AA contrast >= 4.5:1 text / >= 3:1 UI verified by unit tests), fonts (`Cormorant Garamond`, `Jost`), all UI primitives (`src/components/ui/*`), shared components (`primitives`, `Logo`, `Price`, `QuantityStepper`, `Pagination`, `EmptyState`, `ConfirmDialog`, `FormField`, `ResponsiveDataTable`), global layout (`Header`, `MegaMenu`, `MobileNav`, `Footer`, `AnnouncementBar`, `Breadcrumbs`, `CookieBanner`, `ConsentAnalytics`, `ThemeSwitcher`, `ThemeProvider`), `not-found.tsx`, `error.tsx`, `global-error.tsx`, `/dev/ui` showcase, and `scripts/start-server.mjs`.
- **Requirement IDs covered:** DESIGN-01 to DESIGN-10, CW-01 to CW-07, CW-94 to CW-102, A11Y foundations.
- **Gate passed:** `tsc --noEmit`, `eslint .`, `prettier --check`, `vitest` (12/12 unit tests), `next build`, Playwright E2E `design-system.spec.ts` (3/3 passing: home/404 statuses, light/dark axe-core WCAG 2.2 AA with zero serious/critical violations, zero horizontal overflow across all 7 viewports 360–1920 px).
- **Next:** Phase 2 — Data Schema, Migrations, Auth, RBAC, Rate Limiting, Email & Seed.

---

## Phase 2 — Data Schema, Migrations, Auth, RBAC, Rate Limiting, Email & Seed (Completed)

- **Built:** `prisma.config.ts` (Prisma 7 `@prisma/adapter-pg`), full `prisma/schema.prisma`, initial + raw-SQL migrations (`pg_trgm`, `unaccent`, weighted `Product.searchVector` trigger + GIN indexes, stock/price/order `CHECK` constraints, `order_number_seq`), `src/server/prisma-client.ts`, `src/server/db.ts`, Better Auth setup (`src/server/auth.ts`, `src/server/auth-client.ts`, `/api/auth/[...all]` with per-tier rate limiting), `src/server/dal.ts` (`getOptionalSession`, `requireUser`, `requireRole`, `requirePermission`), `src/server/create-action.ts`, `src/server/rate-limit.ts` (Upstash Redis + sliding-window fallback), `src/server/audit.ts` (credential-redacting DB audit logger), React Email templates (`src/emails/*`) & email dispatcher (`Resend` + SMTP/test outbox), `src/proxy.ts`, `/api/health` DB check, `(auth)` pages (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`), RBAC-guarded `/account` and `/admin` entry pages, `prisma/seed.ts` + `prisma/seed-assets.ts` (`sharp` WebP assets).
- **Requirement IDs covered:** SEC-01 to SEC-06, SEC-14, SEC-15, CW-63 to CW-67, SEED-01 to SEED-07, §8 schema & constraints.
- **Gate passed:** `prisma migrate deploy`, idempotent `db:seed`, `tsc --noEmit`, `eslint .`, `prettier --check`, `vitest` (5 files / 23 unit & integration tests), `next build`, Playwright E2E `auth.spec.ts` & `design-system.spec.ts` (6/6 passing).
- **Next:** Phase 3 — Media Upload Pipeline, Admin Shell, Catalogue, Facets, Inventory Ledger, Banners, Articles & Settings.

---

## Phase 3 — Admin Studio, Media Pipeline, Settings, Content & Catalogue (Completed)

- **Built:** Signed media upload pipeline (`src/server/storage.ts`, `/api/uploads/sign`, `/api/uploads/local`, `/api/uploads/confirm`, `src/components/shared/ImageUploadField.tsx`) with `file-type` magic-byte enforcement and `sharp` EXIF stripping + full/medium/thumb WebP generation; sanitized Markdown renderer (`src/lib/markdown.ts`); Settings & Shipping Zones module (`src/modules/settings/*`), Banners (`src/modules/banners/*`), Editorial Articles (`src/modules/articles/*`), and Catalogue + Inventory Ledger (`src/modules/catalog/*`) with hierarchical category path cascading, automatic `SlugRedirect` records, non-empty category delete guards, live stock preservation during product edits, and `SELECT ... FOR UPDATE` atomic stock adjustments with reservation guards; responsive Admin Studio shell (`src/components/admin/AdminShell.tsx`, `src/app/admin/layout.tsx`) and full Admin CRUD interfaces (`/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]` 7-tab editor with live SERP preview, `/admin/categories`, `/admin/attributes`, `/admin/inventory`, `/admin/banners`, `/admin/articles`, and `ADMIN`-restricted `/admin/settings`).
- **Requirement IDs covered:** AD-01 to AD-13, AD-17, AD-18, AD-24 to AD-30, MED-01 to MED-05, SEC-09, SEC-11.
- **Gate passed:** `tsc --noEmit`, `eslint .`, `prettier --check`, `vitest` (7 files / 32 unit & integration tests), `next build` (24 routes built cleanly with `cacheComponents` + PPR), Playwright E2E Chromium suite (9/9 passing across `design-system.spec.ts`, `auth.spec.ts`, and `admin-catalogue.spec.ts` covering 360px/1440px responsive layout, WCAG 2.2 AA axe-core scans, STAFF settings restriction, PNG upload -> WebP processing, product creation, stock ledger adjustment, and archive).
- **Next:** Phase 4 — Customer Storefront: Home, Collections/Filters, Search, Product Detail, Wishlist, Static Pages & Guides.

---

## Phase 4 — Customer Storefront, Search, Wishlist, Initial Bag & Concierge (Completed)

- **Built:**
  - Server-side cached catalog read layer (`src/modules/catalog/catalog.public.ts`) using `"use cache"` + `cacheLife("hours")` + `cacheTag`, enforcing zero `costPrice` projection, `SlugRedirect` resolution across categories & products, recursive descendant category filtering, dynamic facet bucketing, sorting, and pagination.
  - Weighted PostgreSQL Full-Text Search + `pg_trgm` typo-tolerant search engine (`src/modules/search/search.service.ts`) and rate-limited `/api/search/suggest` route handler + live `HeaderSearchBar` typeahead.
  - HMAC-SHA256 signed `maison_guest_id` visitor token (`src/server/guest-token.ts`), Wishlist persistence & login/registration merge (`src/modules/wishlist/*`), initial persisted Shopping Bag (`src/modules/cart/*`) with server-side Decimal pricing & `PRICE_ON_REQUEST` / stock guards, Visitor hydration & client store (`src/modules/storefront/*`), `WishlistToggleButton`, `StorefrontHeaderActions`, and `StorefrontShell`.
  - Concierge Enquiry module (`src/modules/enquiries/*`) and Newsletter subscription module (`src/modules/newsletter/*`) with honeypot + rate limiting + safe async email notifications (`FooterNewsletterForm` in `Footer`).
  - Cached editorial Markdown loader (`src/lib/content.ts`, `content/*.md`), `resolvePublishedArticleBySlug` with `SlugRedirect`, and all public storefront routes (`/(storefront)/page.tsx`, `/collections/[[...slug]]`, `/products/[slug]`, `/search`, `/wishlist`, `/cart`, `/guides`, `/guides/[slug]`, `/contact`, `/about`, `/faq`, `/shipping-returns`, `/ring-size-guide`, `/care-guide`, `/privacy`, `/terms`) using shared reusable storefront components (`ProductCard`, `CollectionFilters`, `ProductGallery`, `ProductDetailClient`, `EnquiryForm`, `CartPageClient`, `WishlistPageClient`, `EditorialContentView`).
- **Requirement IDs covered:** CW-01 to CW-33, CW-49 to CW-54, CW-71 to CW-78, CW-83 to CW-93, CW-103 to CW-107, CW-109, CW-111 to CW-115.
- **Gate passed:** `prettier --check .`, `tsc --noEmit`, `eslint .` (including `design-tokens/no-raw-hex` & no-blue/purple), `vitest` (8 files / 37 tests including FTS/trigram, SlugRedirect, guest token merge, enquiry & newsletter integration), `next build` (40/40 routes cleanly built with `cacheComponents` + PPR), and Playwright E2E Chromium suite (10/10 passing across `design-system`, `auth`, `admin-catalogue`, and `browse-search-wishlist` with zero console errors, zero failed network responses, zero overflow at 360–1920 px, and WCAG 2.2 AA axe-core passing).
- **Next:** Phase 5 — Cart Shipping & Tax Estimator, Atomic Stock-Reserved Checkout, Payment Adapters (Stripe/Razorpay/Sandbox), Webhooks & Cron Jobs.
