# Implementation Plan

This plan executes Phases 0 through 9 from `PROJECT_REQUIREMENTS.md` (§20) in strict sequence, passing every phase gate before advancing.

## Phase 0 — Foundation & Infrastructure

- Initialize Git repository with conventional commit conventions (`commitlint`, `husky`, `lint-staged`).
- Create `package.json` with Next.js 16.4+, React 19, TypeScript (strict + `noUncheckedIndexedAccess`), Tailwind CSS v4, Prisma + `@prisma/adapter-pg`, Better Auth, Zod v4, `@t3-oss/env-nextjs`, Pino, Sentry, Vitest, Playwright, ESLint, Prettier.
- Read `node_modules/next/dist/docs` immediately after install to verify exact Next 16.4 APIs (`proxy.ts`, `'use cache'` / Cache Components, `next/image` `preload`, `next.config.ts`).
- Create `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `prettier.config.mjs`, `commitlint.config.mjs`, `components.json`.
- Create `docker-compose.yml` (PostgreSQL 16, Redis + serverless-redis-http, MinIO + bucket init, Mailpit), `Dockerfile` (standalone), `.env.example`, `.env`, `.github/workflows/ci.yml`.
- Create `src/lib/env.ts`, `src/lib/constants.ts`, `src/lib/utils.ts`, `src/server/logger.ts`, `src/server/errors.ts`, `src/app/api/health/route.ts`, `README.md`.
- **Gate:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` pass; health route responds; Docker services healthy.

## Phase 1 — Design System & Global Shell

- `src/styles/tokens.css`, `src/styles/theme.css`, `src/styles/base.css`, `src/styles/utilities.css`, `src/app/globals.css`.
- Configure `Cormorant Garamond` and `Jost` via `next/font/google` in `src/app/layout.tsx`, `ThemeProvider` (`next-themes`, light/dark/system, no-flash), theme-color meta.
- Reusable UI components (`src/components/ui/*`): Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Slider, Tabs, Accordion, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Sonner, Badge, Card, Skeleton, Table.
- Layout & shared primitives (`src/components/layout/*`, `src/components/shared/*`): Container, Stack, Grid, Section, AnnouncementBar, Header, MegaMenu, MobileNav, Footer, ThemeSwitcher, Breadcrumbs, CookieBanner, Pagination, EmptyState, Price, QuantityStepper, ConfirmDialog, FormField, ResponsiveDataTable.
- Error pages: `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, loading skeletons.
- Dev-only component gallery `/dev/ui` (gated on `NODE_ENV !== 'production'`).
- **Gate:** Unit tests for WCAG 2.2 AA token contrast pairs (light & dark) + no-blue/purple lint rule; Playwright 7-viewport visual/responsive check & axe-core on `/dev/ui` in light and dark themes.

## Phase 2 — Database Schema, Auth, RBAC & Core Infrastructure

- `prisma/schema.prisma`, `prisma.config.ts`, Prisma migrations including raw SQL (`pg_trgm`, `Product.searchVector` trigger + GIN indexes, `CHECK` constraints, `order_number_seq`).
- `prisma/seed.ts` (idempotent production seed: admin user, store settings, shipping zones, base facets; demo data gated on `SEED_DEMO_DATA=true`).
- `src/server/db.ts`, `src/server/auth.ts`, `src/server/dal.ts`, `src/server/create-action.ts`, `src/server/rate-limit.ts`, `src/server/audit.ts`, `src/server/cache-tags.ts`.
- `src/lib/permissions.ts`, `src/lib/money.ts`, `src/lib/slug.ts`, `src/lib/format.ts`, `src/lib/dates.ts`.
- `src/server/email/client.ts`, `src/server/email/send.ts`, and React Email templates (`src/emails/*`: VerifyEmail, ResetPassword, OrderConfirmation, OrderShipped, OrderDelivered, EnquiryReceived).
- `proxy.ts` (CSP nonce, canonical host/HTTPS, optimistic redirects for `/account` and `/admin`).
- Auth routes & actions (`src/app/api/auth/[...all]/route.ts`, `src/modules/auth/*`, `src/app/(auth)/*`: login, register, forgot-password, reset-password, verify-email).
- **Gate:** Integration tests for Prisma constraints/migrations, Better Auth flows, DAL role enforcement across CUSTOMER/STAFF/ADMIN, rate limiter, audit logging.

## Phase 3 — Admin Catalogue, Storage & Settings

- S3/MinIO storage + image pipeline (`src/server/storage/s3.ts`, `src/server/storage/image-pipeline.ts`, `/api/uploads/sign`, `/api/uploads/confirm`).
- `src/components/admin/*`: AdminShell (sidebar + mobile bottom sheet, compact density, top search, theme switcher), PageHeader, DataTable, StatCard, ImageUploader (multi-upload, drag-reorder, alt text, focal point), RichMarkdownEditor (with sanitised preview), StatusBadge.
- Modules & admin pages:
  - Categories (`src/modules/categories/*`, `/admin/categories`) — depth-2 tree, drag-reorder, slug redirects.
  - Facets/Attributes (`src/modules/facets/*`, `/admin/attributes`).
  - Products (`src/modules/catalog/*`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]`) — tabs: General, Variants & Pricing, Images, Diamond Specs, Facets, SEO (live SERP preview & meters), Preview; duplicate, hard-delete vs archive semantics.
  - Inventory (`src/modules/inventory/*`, `/admin/inventory`) — adjustments with mandatory reason, ledger, CSV export.
  - Banners & Articles (`src/modules/content/*`, `/admin/banners`, `/admin/articles`, `/admin/articles/[id]`).
  - Store Settings & Shipping Zones (`src/modules/settings/*`, `/admin/settings`).
- **Gate:** E2E admin CRUD tests (categories, facets, products with variants/diamonds/images, delete vs archive, inventory adjustment, settings), role restriction tests.

## Phase 4 — Storefront Browse, Search & Wishlist

- Homepage (`src/app/(storefront)/page.tsx`): Hero banners (LCP preloaded), category tiles, featured/new/bestseller rails, craftsmanship story, trust strip, latest guides, store/appointment info.
- Category & Listing pages (`src/app/(storefront)/collections/[[...slug]]/page.tsx`): URL-driven filters via `nuqs` (`src/modules/catalog/filters.ts`), adaptive diamond filters, facet counts, sorting, crawlable pagination (24/page), mobile filter bottom sheet, intro + SEO buying guide copy.
- Product Detail page (`src/app/(storefront)/products/[slug]/page.tsx`): Embla gallery + zoom/lightbox, variant matrix with `?variant=`, price/compare-at, stock & delivery estimate, add-to-cart, wishlist heart, enquire modal, specs table + diamond 4Cs block, accordions, related / complete-the-look, recently viewed (`use-recently-viewed.ts`), `isPriceOnRequest` and out-of-stock semantics, `SlugRedirect` + archived 301 handling.
- Search (`src/modules/search/*`, `/api/search/suggest`, `/search`): PostgreSQL FTS + `pg_trgm` typo tolerance + SKU/cert lookup, ARIA combobox overlay.
- Wishlist (`src/modules/wishlist/*`, `/wishlist`): guest cookie + DB persistence, merge on login, move to cart.
- Guides & Content pages (`src/app/(storefront)/guides/*`, MDX static policies in `content/`, `/about`, `/contact`, `/faq`, `/shipping-returns`, `/privacy`, `/terms`, `/care-guide`, `/ring-size-guide`), Enquiries (`src/modules/enquiries/*`).
- **Gate:** Playwright storefront browse/filter/search/wishlist/enquiry E2E, axe-core checks, responsive checks across 7 viewports.

## Phase 5 — Cart, Checkout, Payments & Webhooks

- Cart (`src/modules/cart/*`, `/cart`, CartDrawer): guest cookie → DB, merge on login, price/stock revalidation, free-shipping progress bar, save for later.
- Payment providers (`src/server/payments/provider.ts`, `stripe.ts`, `razorpay.ts`, `index.ts`).
- Checkout (`src/modules/checkout/*`, `/checkout`, `/checkout/success/[orderNumber]`): single-page multi-step accordion/columns, address validation + saved addresses, shipping zone quote + insurance signature rule, atomic server-side re-pricing + `SELECT ... stockQuantity >= qty` reservation transaction (`InventoryMovement(SALE_RESERVE)`), payment intent creation, failure/retry flow.
- Webhooks (`/api/webhooks/stripe`, `/api/webhooks/razorpay`): signature verification, `PaymentWebhookEvent` idempotency, amount verification, confirmation emails.
- Cron endpoints (`/api/cron/release-reservations`, `/api/cron/publish-scheduled`).
- **Gate:** Concurrency race-condition integration test (two concurrent checkouts for stock=1), webhook idempotency test, E2E guest & account checkout + failure/retry.

## Phase 6 — Account, Order Tracking & Admin Operations

- Account (`src/modules/account/*`, `src/app/(account)/account/*`): dashboard, profile, email/password change, address book CRUD, order history/detail, wishlist, account deletion anonymisation + data export.
- Guest Order Tracking (`src/app/(storefront)/orders/track/*`): rate-limited orderNumber + email lookup, signed short-lived access token, visual timeline, carrier/tracking, printable invoice.
- Admin Operations:
  - Orders (`src/modules/orders/*`, `/admin/orders`, `/admin/orders/[id]`): state machine (`state-machine.ts`), tracking update, internal notes, cancel (restores stock), full/partial refund via payment provider, printable invoice & packing slip, resend confirmation email.
  - Customers (`src/modules/customers/*`, `/admin/customers`, `/admin/customers/[id]`): list, detail, role management (last-admin & self-demote guard).
  - Enquiries inbox (`/admin/enquiries`): filter, reply by email, link to product/customer.
  - Admin Dashboard (`/admin/page.tsx`): KPI cards with period comparison, Recharts revenue chart, orders by status, top products, low stock, latest orders, open enquiries.
  - Audit log viewer (`/admin/audit-log`) & CSV exports (`/api/admin/export/[entity].csv`).
- **Gate:** Order lifecycle E2E including status transitions, tracking, refund, stock restoration, guest tracking, admin RBAC & exports.

## Phase 7 — Complete SEO, AI SEO & Discovery

- `src/lib/seo/site-config.ts`, `src/lib/seo/metadata.ts`, `src/lib/seo/robots-policy.ts`, `src/lib/seo/jsonld/*` (organization, website, product, breadcrumb, itemlist, article, merchant-return-policy), `src/components/seo/JsonLd.tsx`.
- `src/app/sitemap.ts` (`generateSitemaps()` segmented static/categories/products/guides with real `lastModified` and images), `src/app/robots.ts`, `src/app/manifest.ts`.
- Dynamic OG images (`src/app/opengraph-image.tsx`, product/category/guide OG routes).
- Merchant Center feed (`/feeds/google-merchant.xml`) and `/llms.txt` (`ENABLE_LLMS_TXT`).
- Internal linking verification + SEO test suite + orphan/broken-link crawler script (`scripts/check-seo-crawl.ts`).
- **Gate:** JSON-LD schema validation unit tests, Playwright SEO verification (unique titles/descriptions, canonicals, robots, 404/301 status codes, zero orphans/broken links).

## Phase 8 — Hardening, Security, Performance & Documentation

- Enforce CSP (nonce-based, configured for Stripe/Razorpay/GA/Sentry), verify all security headers, cookie flags, input `.strict()` Zod checks.
- Performance optimization: check initial JS bundle budget (`<= 150 KB` gzip on storefront routes), verify Cache Components + Suspense boundaries, `preload` on LCP images, `lighthouse` CI config (`lighthouserc.json`).
- Accessibility & visual snapshots across all 7 viewports and light/dark themes.
- Full documentation & runbooks (`docs/RUNBOOKS.md`, `README.md`), coverage verification (`>= 85%` on `modules/**/service.ts`, `lib/**`, `server/**`).
- **Gate:** `tsc --noEmit`, `eslint`, `prettier --check`, unit + integration tests with coverage, production `next build`, Playwright E2E + axe + SEO + visual + 7-viewport suite, Lighthouse CI.

## Phase 9 — Final Audit & Launch Verification

- Verify every requirement ID in `PROJECT_REQUIREMENTS.md` (§5, §6, §7, §8, §11, §12, §13, §14, §15, §16, §17, §18, §19, §21) against files and test runs.
- Create `docs/FINAL_AUDIT.md` mapping every requirement ID to implementation paths and test proof, noting external-credential items verified in test mode.
- Verify git status clean and all checks passing after final edits.
