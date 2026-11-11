# PROJECT_REQUIREMENTS.md

**Project:** Premium Jewellery & Diamond E-Commerce Platform (customer storefront + admin panel)
**Document version:** 1.0 — 11 November 2026
**Status:** Approved baseline for development (changes only via §0.3)
**Working brand name:** `<BRAND>` — a single configurable value (`NEXT_PUBLIC_SITE_NAME` + Store Settings), never hard-coded in components.

---

## 0. Document Control

### 0.1 Purpose

This file is the **single source of truth** for the whole build. Every architectural choice, requirement, schema, route, token, and acceptance criterion lives here. If code and this document disagree, one of them is wrong and must be fixed in the same pull request.

### 0.2 How to read requirement IDs

| Prefix | Meaning                                 | Prefix  | Meaning                           |
| ------ | --------------------------------------- | ------- | --------------------------------- |
| `CW-`  | Customer website functional requirement | `SEC-`  | Security requirement              |
| `AD-`  | Admin panel functional requirement      | `PERF-` | Performance requirement           |
| `UX-`  | UI/UX & design-system requirement       | `A11Y-` | Accessibility requirement         |
| `SEO-` | Classic/technical SEO requirement       | `AI-`   | AI SEO / AEO / GEO requirement    |
| `DB-`  | Data/schema rule                        | `OPS-`  | Deployment/operations requirement |

Priority words: **MUST** (launch blocker), **SHOULD** (expected, may slip with written reason), **MAY** (optional).

### 0.3 Change process

1. Propose the change in a PR that edits this file first.
2. Update the traceability matrix (§21) and affected sections.
3. Only then change code. Record the decision in the Decision Log (§22.1).

### 0.4 Table of contents

1. Vision, scope, personas, success metrics
2. Research findings & resulting decisions
3. Technology stack
4. System architecture
5. Customer website requirements
6. Admin panel requirements
7. Roles & permissions
8. Database design
9. API design
10. Folder structure & module guide
11. UI/UX design system
12. CSS & theme architecture
13. SEO specification
14. AI SEO / AEO / GEO specification
15. Performance
16. Security & privacy
17. Error handling & observability
18. Testing & QA
19. Deployment & DevOps
20. Implementation plan
21. Requirements traceability matrix
22. Decision log, assumptions & open questions
23. Appendices

---

## 1. Vision, Scope, Personas, Success Metrics

### 1.1 Vision

A luxurious, trustworthy online jewellery house for **diamonds, engagement and fine rings, and other fine jewellery**, matching the polish of international maisons: calm, editorial, image-led, with absolute clarity on price, certification, materials, delivery, and returns.

### 1.2 In scope (v1 — all MUST be fully working, no placeholders)

- Customer site: homepage, category/listing pages, product detail, search with suggestions, filters/sorting, wishlist, cart, guest + account checkout, online payment, registration/login/password reset/email verification, account area (profile, addresses, orders, wishlist), order tracking (account and guest lookup), enquiry/contact form, content pages, jewellery guides.
- Admin panel: dashboard; product CRUD with variants, images, diamond specs, facets, SEO fields; category CRUD with hierarchy; attribute/facet management; inventory with audit ledger; order list/detail with status management, tracking details, notes, refunds; customer list/detail; banners; articles/guides; enquiries inbox; store settings (shipping, tax, policies, SEO defaults); audit log; role management.
- Light/dark themes with switcher, full responsiveness, complete SEO + AI SEO, security, performance, tests, CI/CD, deployment.

### 1.3 Explicitly out of scope for v1 (so nothing half-built ships)

Multi-vendor marketplace; runtime multi-currency conversion (one store currency, configurable); coupons/gift cards/loyalty (Phase 2); customer product reviews and ratings (Phase 2 — rating markup is emitted **only** when real reviews exist); made-to-measure/engraving configurators; native mobile apps; multi-language (structure is i18n-ready, one locale ships); agentic-commerce protocols (watch-list only, §14.7).

### 1.4 Personas

| Persona                     | Needs                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| **Gift buyer**              | Fast discovery, price filters, occasion cues, delivery dates, easy returns, gift-ready confidence   |
| **Engagement-ring shopper** | Diamond 4Cs, certificate details, ring-size guidance, insured delivery, reassurance, enquiry option |
| **Returning customer**      | Wishlist, saved addresses, order history and tracking                                               |
| **Store owner (ADMIN)**     | Complete catalogue/order/customer control without developer help                                    |
| **Staff (STAFF)**           | Process orders and inventory, no destructive/system access                                          |

### 1.4 Success metrics (measured post-launch)

Lighthouse mobile ≥ 95 (Performance) on Home/PLP/PDP; Core Web Vitals "Good" at p75 (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1); 100 % of indexable URLs valid in sitemap and Search Console with zero critical structured-data errors; checkout conversion, AOV, enquiry rate, and AI-referral sessions tracked in analytics.

---

## 2. Research Findings & Resulting Decisions

Research performed on 11 Nov 2026 against official docs and trusted sources. Re-verify any version-specific API against the **version-matched docs bundled in `node_modules/next/dist/docs`** at install time (Next.js 16.3+ maintains an `AGENTS.md` pointing coding agents to them).

### 2.1 Framework & tooling

| Finding                                                                                                                                                                                                                                                                                   | Source                                     | Decision                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js 16 is the current major; 16.3 (Aug 2026) added Instant Navigations, faster dev/build, fewer prefetch requests, TS 7 type-checking option; 16.4.x is current with a patch cadence that now includes **scheduled monthly security releases** (latest at research time: 3 Nov 2026). | nextjs.org/blog, nextjs.org/blog/next-16-3 | Start on the latest 16.4.x patch; subscribe to security releases; Renovate/Dependabot weekly; patch within 7 days of any security release. |
| Next.js 16 renamed `middleware.ts` → **`proxy.ts`**.                                                                                                                                                                                                                                      | Auth.js docs, LogRocket                    | Use `proxy.ts` only for coarse, optimistic checks.                                                                                         |
| Middleware-only protection was bypassable (CVE-2025-29927). Auth.js docs explicitly say not to rely on the proxy alone.                                                                                                                                                                   | LogRocket, authjs.dev                      | **Authorization is enforced in the Data Access Layer and every server action/route handler**, never only in `proxy.ts` (SEC-02).           |
| Auth.js is now part of Better Auth; new projects are steered to **Better Auth**.                                                                                                                                                                                                          | authjs.dev, LogRocket, MakerKit            | Use **Better Auth** with the Prisma adapter.                                                                                               |
| Next.js 16.3 direction: "dynamic by default, no hidden implicit caching".                                                                                                                                                                                                                 | next-16-3 post                             | Use explicit caching (`'use cache'` / Cache Components) for catalogue reads only; everything personalised is dynamic.                      |

### 2.2 SEO & AI search

| Finding                                                                                                                                                                                                                                                                                                                                                                                                     | Source                                                                                         | Decision                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google published "Optimizing your website for generative AI features on Google Search" (15 May 2026). Its stance: this is **still SEO**; the technical gate is that a page is indexed and eligible for a snippet; unique, non-commodity content matters most; no special AI files are required.                                                                                                             | Search Engine Journal, PPC Land, Semrush, Google Search Central "AI features and your website" | AI SEO (§14) is built on **crawlability, indexability, snippet eligibility, unique expert content, structured data, merchant data** — not gimmicks. |
| `llms.txt` is **not needed for Google**; benefit on other engines is unproven.                                                                                                                                                                                                                                                                                                                              | SEJ, Nebo, Cassie Clark                                                                        | Ship as a cheap, generated, feature-flagged file; never treat it as a ranking lever.                                                                |
| Google asks that crawling is allowed in robots.txt **and by any CDN/hosting infrastructure**, content is findable through internal links, and page experience is good.                                                                                                                                                                                                                                      | Google "AI features and your website"                                                          | WAF/CDN allow-list for Googlebot and chosen AI retrieval bots (SEO-26, AI-03).                                                                      |
| Google is testing a Search Console control and reporting for generative-AI appearance (UK first).                                                                                                                                                                                                                                                                                                           | blog.google                                                                                    | Monitor; wire into reporting when available in the property.                                                                                        |
| Product pages need Product/Offer structured data; **shipping (`shippingDetails`) and return policy (`hasMerchantReturnPolicy`)** markup or Search Console shipping/returns settings improve merchant-listing eligibility. Search Console settings **override** on-page markup, so both must be kept consistent. Merchant Center free listings and product feeds support shopping surfaces and AI responses. | Google Search Central product docs (via Pemavor, techhelp summaries)                           | Emit complete Product/Offer/ProductGroup JSON-LD + Organization-level return policy + a Merchant Center feed (SEO-12…SEO-16).                       |
| FAQ rich results are no longer shown for most sites.                                                                                                                                                                                                                                                                                                                                                        | Industry coverage                                                                              | FAQ content stays **visible for users and answer engines**; FAQPage JSON-LD is optional and never relied upon for Google rich results.              |

### 2.3 Resulting "golden rules"

1. Everything indexable is **server-rendered HTML** (prices, specs, copy, links). AI crawlers frequently do not execute JavaScript.
2. One canonical URL per piece of content; facets/sorts never create indexable duplicates.
3. Unique content: original photography, certified specs, craftsmanship detail, expert guides.
4. Security is enforced at the data layer, never only at the edge.
5. Reuse mature libraries; write bespoke code only for domain logic.

---

## 3. Technology Stack

> Install the **latest stable** release of each dependency at project start, then lock via the lockfile. Majors listed are the targets.

| Layer                 | Choice                                                                                                                       | Why                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Runtime               | **Node.js 24 LTS** (minimum 22 LTS)                                                                                          | Supported by Next 16; long support window                                                                                           |
| Framework             | **Next.js 16.4.x** (App Router, Turbopack, React Compiler enabled, Cache Components)                                         | SSR/ISR, Metadata API, sitemaps, image optimisation, server actions, route handlers — frontend + backend in one TypeScript codebase |
| UI runtime            | **React 19.x**                                                                                                               | Server Components, `useActionState`, transitions                                                                                    |
| Language              | **TypeScript** (strict, `noUncheckedIndexedAccess`)                                                                          | Type safety end to end; TS 7 type-check optional once stable in CI                                                                  |
| Styling               | **Tailwind CSS v4** (CSS-first `@theme`) + CSS variable design tokens                                                        | Fast, consistent, theme-able                                                                                                        |
| Components            | **shadcn/ui** (Radix primitives) copied into `components/ui`, `lucide-react` icons                                           | Accessible primitives, no lock-in                                                                                                   |
| Theme                 | **next-themes** (`class` strategy, system default)                                                                           | No flash, SSR-safe                                                                                                                  |
| Motion                | **motion** (framer-motion successor), respects `prefers-reduced-motion`                                                      | Subtle luxury transitions                                                                                                           |
| Forms/validation      | **react-hook-form** + **Zod v4** (`@hookform/resolvers`)                                                                     | One schema shared by client and server                                                                                              |
| URL state             | **nuqs**                                                                                                                     | Type-safe filter/sort/page state in the URL (shareable, crawl-controlled)                                                           |
| Tables                | **TanStack Table** + shadcn Data Table                                                                                       | Admin lists (sorting, filtering, pagination, column visibility)                                                                     |
| Charts                | shadcn Charts (**Recharts**)                                                                                                 | Dashboard                                                                                                                           |
| Carousel / DnD        | **embla-carousel**, **@dnd-kit**                                                                                             | Product galleries; reorder images/categories                                                                                        |
| Toasts                | **sonner**                                                                                                                   | Feedback                                                                                                                            |
| Database              | **PostgreSQL 16+** (managed: Neon / Supabase / RDS)                                                                          | Relational integrity, FTS, `pg_trgm`                                                                                                |
| ORM                   | **Prisma ORM** (current stable, driver adapter for `pg`)                                                                     | Typed queries, migrations                                                                                                           |
| Auth                  | **Better Auth** (+ `admin` plugin, `nextCookies` plugin)                                                                     | Successor of Auth.js, self-hosted, TypeScript-native                                                                                |
| Payments              | **Stripe** (Payment Element) and **Razorpay** adapters behind one `PaymentProvider` interface; active provider chosen by env | Gateway-agnostic; store currency decides which is enabled                                                                           |
| Storage               | **S3-compatible object storage** (Cloudflare R2 / AWS S3) via presigned uploads; local MinIO in dev                          | Cheap, scalable image storage                                                                                                       |
| Email                 | **Resend** + **React Email** templates                                                                                       | Transactional email                                                                                                                 |
| Rate limiting / cache | **Upstash Redis** + `@upstash/ratelimit` (in-memory fallback for dev only)                                                   | Abuse protection                                                                                                                    |
| Search                | **PostgreSQL FTS + pg_trgm** behind a `SearchService` interface                                                              | No extra infra at launch; swappable for Typesense/Meilisearch                                                                       |
| SEO helpers           | Next Metadata API, `schema-dts` (typed JSON-LD), `next/og`                                                                   | Typed, maintainable structured data                                                                                                 |
| Analytics             | **GA4 loaded only after cookie consent** (+ Vercel Speed Insights); Search Console + Merchant Center verification            | Measurement with privacy compliance                                                                                                 |
| Monitoring            | **Sentry** (`@sentry/nextjs`), structured logs (`pino`)                                                                      | Errors/performance                                                                                                                  |
| Testing               | **Vitest**, **Testing Library**, **Playwright**, **@axe-core/playwright**, **Lighthouse CI**                                 | Unit/integration/e2e/a11y/perf                                                                                                      |
| Quality               | ESLint (flat config, `eslint-config-next`, jsx-a11y), Prettier, `tsc --noEmit`, Husky + lint-staged, Commitlint              | Consistency                                                                                                                         |
| Env                   | `@t3-oss/env-nextjs` + Zod                                                                                                   | Fail-fast env validation                                                                                                            |
| Hosting               | **Vercel** (recommended) or Docker/`output: 'standalone'` on any Node host                                                   | See §19                                                                                                                             |

---

## 4. System Architecture

### 4.1 Overview

```
                         ┌───────────────────────────── CDN / Edge (WAF allow-lists Googlebot + AI retrieval bots)
Browser / Crawler ──────▶│  proxy.ts  (coarse redirects, CSP nonce, security headers)
                         └──────────────┬──────────────
                                        ▼
                  Next.js App (Node runtime, App Router)
   ┌────────────────────────────────────────────────────────────────────┐
   │ Server Components (pages)  ── read ─▶  modules/*/queries.ts  (cached reads)
   │ Server Actions (mutations) ── call ─▶  modules/*/service.ts  (business rules)
   │ Route Handlers (webhooks, feeds, uploads, suggest, cron, export)    │
   │                    │                                                │
   │       server/dal.ts  (verifySession, requireRole) ◀─ every entry    │
   └───────────────┬───────────────┬──────────────┬─────────────────────┘
                   ▼               ▼              ▼
              PostgreSQL     Object storage     External: Stripe/Razorpay, Resend,
              (Prisma)       (R2/S3)            Upstash Redis, Sentry
```

### 4.2 Layering rules (clean architecture, pragmatic)

1. **UI layer** (`app/**/page.tsx`, `components/**`): rendering only; no business logic, no direct Prisma imports.
2. **Module layer** (`modules/<domain>/`): `queries.ts` (reads), `actions.ts` (server actions: parse → authorise → call service → revalidate), `service.ts` (business rules, transactions), `schemas.ts` (Zod), `types.ts`, `components/` (domain UI).
3. **Server infrastructure** (`server/`): `db.ts`, `auth.ts`, `dal.ts`, `payments/`, `storage/`, `email/`, `rate-limit.ts`, `audit.ts`, `logger.ts`. Every file starts with `import 'server-only'`.
4. **Shared lib** (`lib/`): pure helpers (money, slug, format, seo builders, constants). No I/O.
5. Dependency direction: `app → modules → server → lib`. Never upwards.

### 4.3 Rendering & caching strategy

| Route type                                     | Strategy                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home, category, product, guides, content pages | Server-rendered with **Cache Components**: catalogue reads in `'use cache'` functions with `cacheLife` and `cacheTag` (`products`, `product:<id>`, `category:<id>`, `articles`, `settings`). Admin mutations invalidate the exact tags. Personalised UI (cart count, wishlist hearts, user menu) streams in **Suspense holes**. |
| Search, filtered listings                      | Dynamic (URL-driven), short-lived cache on identical queries                                                                                                                                                                                                                                                                    |
| Cart, checkout, account, admin, order tracking | Fully dynamic, `no-store`, `noindex`                                                                                                                                                                                                                                                                                            |
| `sitemap.xml`, `robots.txt`, feeds             | Generated, cached, revalidated on catalogue change                                                                                                                                                                                                                                                                              |

Use `loading.tsx` + Suspense skeletons matching final layout (no CLS). Confirm exact cache API signatures in the bundled Next docs before coding.

### 4.4 Cross-cutting patterns

- **Action wrapper** `createAction({ schema, role, rateLimit }, handler)` standardises: Zod parse → `requireRole` → rate limit → handler → audit log → typed `ActionResult<T>`.
- **Result type:** `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`. Actions never throw to the UI for expected failures.
- **Errors:** `AppError` subclasses (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `OutOfStockError`, `PaymentError`) mapped to HTTP status / UI messages.
- **Money:** `Decimal` everywhere, formatted only at the edge via `Intl.NumberFormat`.
- **Idempotency:** payment webhooks recorded in `PaymentWebhookEvent` (unique provider event id).
- **Audit:** every admin mutation writes `AuditLog` (actor, entity, action, diff summary).

---

## 5. Customer Website Requirements

### 5.1 Global shell

- **CW-01** Announcement bar (admin-editable text/link, dismissible per session), sticky header (logo, primary nav with **mega-menu** from category tree, search, wishlist, account, cart), mobile slide-in nav drawer, footer (shop links, guides, policies, contact, social, payment/trust badges).
- **CW-02** Theme switcher (Light / Dark / System) in header and footer; persisted; no flash (§12.5).
- **CW-03** Cart drawer (mini-cart) with quantity update, remove, subtotal, checkout CTA.
- **CW-04** Breadcrumbs on every non-home page (UI + `BreadcrumbList` JSON-LD).
- **CW-05** Cookie consent banner with real preference storage; analytics scripts load only after consent.

### 5.2 Homepage

- **CW-10** Admin-managed hero banners (image, heading, subheading, CTA, focal point, light/dark text variants), category tiles, featured products, new arrivals, bestsellers (driven by product flags), craftsmanship/brand story block, certification & service trust strip (insured shipping, certified diamonds, returns), latest guides, store/appointment info (if a physical store is configured in Settings).
- **CW-11** Single `<h1>`; first hero image is the LCP element and is preloaded.

### 5.3 Category & listing pages (`/collections/...`)

- **CW-20** Two-level category hierarchy; parent page lists subcategory tiles + products of all descendants.
- **CW-21** Filters (URL-driven via nuqs): price range, metal, gemstone, diamond shape, carat range, colour, clarity, cut, certification, origin (natural/lab-grown), occasion, style, availability. Filter set adapts to category (diamond filters appear only where diamonds exist). Facet counts shown.
- **CW-22** Sorting: Featured, Newest, Price low→high, Price high→low, Bestselling.
- **CW-23** Numbered pagination (24/page) — crawlable `<a>` links, no infinite scroll. Mobile uses a filter bottom-sheet with applied-filter chips and "Clear all".
- **CW-24** Product card: primary + hover image (desktop), name, from-price, badge (New/Bestseller/Only 1 left/Made to order), wishlist heart, quick-add only for single-variant products.
- **CW-25** Intro copy (admin-managed, above the fold, ≤ 120 words) and expanded buying-guide copy below the grid for SEO/AEO.
- **CW-26** Empty states: no results → suggestions and reset filters.

### 5.4 Product detail page (`/products/[slug]`)

- **CW-30** Gallery (embla): up to 12 images, zoom/lightbox, keyboard + swipe, thumbnails, optional video; LCP image preloaded.
- **CW-31** Title, short description, price (with compare-at), tax/shipping note, stock state, delivery estimate (from lead time + shipping rates).
- **CW-32** Variant selectors (metal, ring size, chain length…) that update price, SKU, images, availability; unavailable combinations disabled with reason; deep-linkable via `?variant=`.
- **CW-33** Add to cart, add to wishlist, **Enquire about this piece** (opens real enquiry form storing `ContactMessage` linked to product).
- **CW-34** Specification table (materials, weight, dimensions, stone details); **Diamond block** for diamond products (carat, cut, colour, clarity, shape, measurements, origin, fluorescence, certification lab + number + certificate link).
- **CW-35** Accordion: Description, Details & Care, Shipping & Returns, Certification/Authenticity.
- **CW-36** Related products and "Complete the look" (same category / shared facets), recently viewed (client-side, localStorage, no PII).
- **CW-37** `isPriceOnRequest` products hide cart and show enquiry only (and omit `Offer` price markup).
- **CW-38** Out-of-stock products stay live (HTTP 200), show "Notify me / Enquire"; archived products redirect (§13.4).

### 5.5 Search

- **CW-40** Header search overlay with debounced suggestions (products, categories, guides) from `/api/search/suggest`, keyboard navigable (ARIA combobox).
- **CW-41** `/search?q=` results page using the same listing component and filters; typo tolerance via `pg_trgm`; SKU and certificate-number lookup; `noindex,follow`.

### 5.6 Wishlist

- **CW-50** Heart toggle everywhere; works for guests (httpOnly `guest_id` cookie → DB) and merges into the account on login; `/wishlist` page with move-to-cart and remove; shareable only by the owner (no public lists in v1).

### 5.7 Cart

- **CW-60** Persistent cart (guest cookie → DB; merged on login). Line items with image, variant options, price, qty stepper (respects stock), remove, "save for later → wishlist".
- **CW-61** Cart revalidates price/stock on every load and shows clear messages if anything changed.
- **CW-62** Order summary: subtotal, shipping (once country known), tax, total; free-shipping progress bar when threshold configured.

### 5.8 Checkout (`/checkout`)

- **CW-70** Steps: Contact → Shipping address → Shipping method → Payment → Review. Single page, accordion-style on mobile. Guest checkout with optional account creation.
- **CW-71** Address form with country-aware fields, `autocomplete` attributes, inline validation, saved-address picker for signed-in users, billing = shipping toggle.
- **CW-72** Shipping methods and costs from admin-configured zones; insured/signature-required flag for high-value orders; free-shipping threshold.
- **CW-73** Payment via the active provider; payment form themed with design tokens (no default provider purple/blue).
- **CW-74** Server creates the order **only after server-side re-pricing and stock reservation** (§8.6). Client totals are never trusted.
- **CW-75** Confirmation page + confirmation email (order summary, address, estimated delivery, tracking link).
- **CW-76** Payment failure/abandon → order stays `PENDING_PAYMENT`, stock released after 30 min by cron; user can retry from the order page.

### 5.9 Authentication & account

- **CW-80** Register (name, email, password, optional phone), email verification, login, logout, forgot/reset password. Password policy: ≥ 10 chars, breach-aware check optional; rate-limited.
- **CW-81** Optional "Continue with Google" if credentials configured (env-gated).
- **CW-82** `/account`: dashboard, profile (name, phone, change password, change email with re-verification), address book (CRUD, default flags), orders list/detail, wishlist, account deletion request (anonymises PII, keeps order records for legal retention).
- **CW-83** Redirect back to the intended page after login.

### 5.10 Order tracking

- **CW-90** Signed-in: `/account/orders/[orderNumber]`. Guests: `/orders/track` (order number + email) → short-lived signed session → read-only order view. Rate-limited, generic error messages (no account enumeration).
- **CW-91** Visual timeline from `OrderStatusEvent` (Placed → Paid → Processing → Shipped → Delivered), carrier name, tracking number and link, estimated delivery, invoice print view.
- **CW-92** Email notifications on key status changes (paid, shipped with tracking, delivered, cancelled, refunded).

### 5.11 Content & trust pages

- **CW-100** Pages: About, Contact (details + working form), Shipping & Returns, Privacy, Terms, Care Guide, Ring Size Guide, Diamond Guide (4Cs), FAQ. Static legal/policy pages are MDX in `content/`; guides/journal are DB articles managed in admin.
- **CW-101** Guides (`/guides/[slug]`): author byline with bio, published/updated dates, table of contents, related products, internal links.
- **CW-102** Custom `404` and `500` pages with search and category links; correct status codes.

---

## 6. Admin Panel Requirements (`/admin`, `noindex`, role-gated)

### 6.1 Shell

- **AD-01** Collapsible sidebar (bottom sheet navigation on mobile), top bar with global search (orders by number/email, products by name/SKU, customers by email), theme switcher, user menu. All admin lists are card-lists on small screens.
- **AD-02** Breadcrumbs, unsaved-changes guard on forms, consistent toast feedback, keyboard-friendly.

### 6.2 Dashboard

- **AD-10** KPI cards (revenue, orders, AOV, new customers; period selector today/7/30/90 days with delta vs previous), revenue chart, orders-by-status, top products, low-stock list, latest orders, open enquiries count.

### 6.3 Products

- **AD-20** List: server-side search, filters (status, category, stock state, featured), sorting, pagination, column visibility, bulk actions (publish, draft, archive, feature), CSV export.
- **AD-21** Create/Edit form (tabs): **General** (name, slug auto-generated + editable, short/long description in Markdown with preview, category, brand, flags: featured/new/bestseller, made-to-order + lead time, price-on-request) · **Variants & Pricing** (option builder for metal/size/etc., per-variant SKU, price, compare-at, weight, barcode/GTIN, stock) · **Images** · **Diamond specs** · **Facets** · **SEO** (meta title/description override with live SERP preview + length meters, OG image override) · **Preview** (renders the storefront page for drafts).
- **AD-22** Image manager: multi-upload with progress, drag-reorder, set primary, mandatory **alt text** per image, auto-generated SEO file names (`<slug>-<n>.webp`), per-variant image assignment, delete with confirmation. Server verifies type by magic bytes, size ≤ 10 MB, strips EXIF, records width/height and `blurDataURL`.
- **AD-23** **Delete semantics:** product never ordered → hard delete (with confirmation, images removed from storage). Product has orders → blocked with explanation and one-click **Archive** (archived = hidden, URL 301s to category).
- **AD-24** Slug change automatically creates a `SlugRedirect` (old → new).
- **AD-25** Duplicate product action.

### 6.4 Categories & attributes

- **AD-30** Category tree (max depth 2) with drag-reorder, name, slug, image, description (intro) + long-form SEO copy, meta overrides, active toggle. Delete blocked while it has products or children (offers reassign flow).
- **AD-31** Facet management: facet types (Metal, Gemstone, Diamond Shape, Occasion, Style…) and values (label, slug, swatch/icon), reorder, usage count, safe delete.

### 6.5 Inventory

- **AD-40** Inventory table by variant: SKU, on-hand, low-stock threshold, status; inline adjust with **mandatory reason**; full movement ledger per variant; low-stock and out-of-stock filters; CSV export.

### 6.6 Orders

- **AD-50** List: search (number, email, name), filters (status, payment status, date range), sorting, pagination, CSV export.
- **AD-51** Detail: items, totals, customer, addresses, payment info, timeline, internal notes, tracking (carrier, number, URL), **status transitions limited to the state machine (§8.5)**, "notify customer" toggle, **refund** (full/partial via gateway), cancel (restores stock), printable invoice and packing slip (print CSS), resend confirmation email.
- **AD-52** Every status change creates `OrderStatusEvent` + `AuditLog`.

### 6.7 Customers

- **AD-60** List all registered customers (name, email, verified?, orders count, lifetime spend, joined, last order) with search, sort, pagination, CSV export.
- **AD-61** Detail: profile, addresses, order history, wishlist count, enquiries. ADMIN can change roles (CUSTOMER/STAFF/ADMIN); cannot demote themselves or the last admin.

### 6.8 Content & operations

- **AD-70** Banners (hero/promo): CRUD, schedule (start/end), order, active toggle, image with alt text and focal point.
- **AD-71** Articles/Guides: Markdown editor with preview, cover image, author, status (draft/published), scheduled publish, SEO fields, related products picker.
- **AD-72** Enquiries inbox: list, filter by status (new/in-progress/resolved), view, reply by email, link to product/customer.
- **AD-73** Store Settings: identity (name, logo, favicon, contact, address, opening hours, social links), currency/locale, tax (rate, inclusive/exclusive, label e.g. GST/VAT), shipping zones/rates/free threshold/insurance threshold, return policy (days, method, fees → drives structured data), order-number prefix, announcement bar, SEO defaults (title template, default OG image, organisation schema fields), AI-crawler policy, analytics IDs.
- **AD-74** Audit log viewer (who/what/when, filter by actor/entity).

---

## 7. Roles & Permissions

| Capability                                  | CUSTOMER |      STAFF      | ADMIN |
| ------------------------------------------- | :------: | :-------------: | :---: |
| Browse, cart, checkout, own account/orders  |    ✔     |        ✔        |   ✔   |
| View admin dashboard                        |    ✖     |        ✔        |   ✔   |
| Products & categories: create/edit          |    ✖     |  ✔ (no delete)  |   ✔   |
| Products & categories: delete/archive       |    ✖     |        ✖        |   ✔   |
| Inventory adjust                            |    ✖     |        ✔        |   ✔   |
| Orders: view / change status / add tracking |    ✖     |        ✔        |   ✔   |
| Orders: refund / cancel paid order          |    ✖     |        ✖        |   ✔   |
| Customers: view                             |    ✖     | ✔ (limited PII) |   ✔   |
| Customers: change role, export              |    ✖     |        ✖        |   ✔   |
| Banners, articles, enquiries                |    ✖     |        ✔        |   ✔   |
| Store settings, audit log                   |    ✖     |        ✖        |   ✔   |

Enforcement: `requireRole(['ADMIN'])` etc. in `server/dal.ts`, called by **every** admin page, action, route handler, and export. Permission map lives in `lib/permissions.ts` (single table, unit-tested).

---

## 8. Database Design (PostgreSQL + Prisma)

### 8.1 Conventions

- IDs: `cuid2` strings. Timestamps: `createdAt`, `updatedAt` on all tables.
- **Money = `Decimal(14,2)`** (never floats; avoids minor-unit overflow for high-value diamonds). Payment adapters convert to minor units at the boundary.
- Snapshots: order lines and addresses are copied at purchase time; later catalogue edits never alter past orders.
- Soft state via `status` enums, not boolean flags, where lifecycle matters.
- Indexes on every foreign key and every filter/sort column; partial/GIN indexes for search.

### 8.2 Prisma schema (authoritative)

> Generator/datasource syntax follows the Prisma version installed (Prisma 7 moves connection config to `prisma.config.ts`). Better Auth core tables are generated by its CLI and merged here.

```prisma
// ───────────── Enums ─────────────
enum Role            { CUSTOMER STAFF ADMIN }
enum ProductStatus   { DRAFT ACTIVE ARCHIVED }
enum DiamondOrigin   { NATURAL LAB_GROWN }
enum OrderStatus     { PENDING_PAYMENT PAID PROCESSING SHIPPED DELIVERED CANCELLED RETURNED REFUNDED }
enum PaymentStatus   { PENDING REQUIRES_ACTION SUCCEEDED FAILED PARTIALLY_REFUNDED REFUNDED }
enum PaymentProvider { STRIPE RAZORPAY }
enum InventoryReason { RESTOCK SALE_RESERVE RESERVE_RELEASE ADJUSTMENT RETURN DAMAGE }
enum ArticleStatus   { DRAFT PUBLISHED }
enum InquiryStatus   { NEW IN_PROGRESS RESOLVED }

// ───────────── Auth & customers (Better Auth tables + profile) ─────────────
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  phone         String?
  role          Role      @default(CUSTOMER)
  deletedAt     DateTime?              // anonymised accounts
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  addresses     Address[]
  orders        Order[]
  carts         Cart[]
  wishlist      WishlistItem[]
  @@index([role])
  @@index([createdAt])
}
model Session {
  id String @id  token String @unique  expiresAt DateTime
  ipAddress String?  userAgent String?
  userId String  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId])
}
model Account {
  id String @id  accountId String  providerId String
  userId String  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken String?  refreshToken String?  idToken String?  password String?
  accessTokenExpiresAt DateTime?  refreshTokenExpiresAt DateTime?  scope String?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId])
}
model Verification {
  id String @id  identifier String  value String  expiresAt DateTime
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([identifier])
}
model Address {
  id String @id @default(cuid())
  userId String  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  label String?  fullName String  phone String
  line1 String  line2 String?  city String  region String  postalCode String  country String // ISO-3166 alpha-2
  isDefaultShipping Boolean @default(false)  isDefaultBilling Boolean @default(false)
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId])
}

// ───────────── Catalogue ─────────────
model Category {
  id String @id @default(cuid())
  parentId String?  parent Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  name String  slug String @unique  path String @unique       // "rings/engagement-rings"
  description String?  seoCopy String?                         // intro + long-form
  imageUrl String?  imageAlt String?
  metaTitle String?  metaDescription String?
  sortOrder Int @default(0)  isActive Boolean @default(true)
  products Product[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([parentId, sortOrder])
}
model Product {
  id String @id @default(cuid())
  slug String @unique  name String
  shortDescription String  description String           // Markdown
  categoryId String  category Category @relation(fields: [categoryId], references: [id])
  brand String?  status ProductStatus @default(DRAFT)
  isFeatured Boolean @default(false) isNewArrival Boolean @default(false) isBestseller Boolean @default(false)
  isMadeToOrder Boolean @default(false)  leadTimeDays Int?
  isPriceOnRequest Boolean @default(false)
  metal String?  materialNotes String?  weightGrams Decimal? @db.Decimal(8,3)
  careInstructions String?
  metaTitle String?  metaDescription String?  ogImageUrl String?
  minPrice Decimal @db.Decimal(14,2)  maxPrice Decimal @db.Decimal(14,2)   // denormalised from variants for fast sort/filter
  salesCount Int @default(0)
  publishedAt DateTime?
  searchVector Unsupported("tsvector")?                                    // maintained by trigger
  variants ProductVariant[]  images ProductImage[]  diamond DiamondSpec?
  facets ProductFacetValue[]  wishlistedBy WishlistItem[]  inquiries ContactMessage[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([categoryId, status])  @@index([status, publishedAt])
  @@index([isFeatured])  @@index([minPrice])
  // raw SQL migration adds: GIN(searchVector), GIN(name gin_trgm_ops)
}
model ProductVariant {
  id String @id @default(cuid())
  productId String  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku String @unique  barcodeGtin String?  mpn String?
  title String                                          // "18K Yellow Gold / Size 6"
  options Json                                          // {"metal":"18k-yellow-gold","size":"6"}
  price Decimal @db.Decimal(14,2)  compareAtPrice Decimal? @db.Decimal(14,2)
  stockQuantity Int @default(0)  lowStockThreshold Int @default(2)
  weightGrams Decimal? @db.Decimal(8,3)
  imageId String?  isActive Boolean @default(true)  sortOrder Int @default(0)
  movements InventoryMovement[]  cartItems CartItem[]  orderItems OrderItem[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([productId])
  // CHECK (stockQuantity >= 0) added in raw migration
}
model ProductImage {
  id String @id @default(cuid())
  productId String  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url String  storageKey String  alt String               // alt REQUIRED
  width Int  height Int  blurDataUrl String?  sortOrder Int @default(0)  isPrimary Boolean @default(false)
  @@index([productId, sortOrder])
}
model DiamondSpec {
  productId String @id  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  origin DiamondOrigin  shape String  caratWeight Decimal @db.Decimal(6,2)
  cut String?  color String  clarity String
  polish String?  symmetry String?  fluorescence String?
  lengthMm Decimal? @db.Decimal(5,2)  widthMm Decimal? @db.Decimal(5,2)  depthMm Decimal? @db.Decimal(5,2)
  certLab String?  certNumber String?  certUrl String?
  @@index([shape]) @@index([caratWeight]) @@index([color, clarity]) @@index([origin])
}
model FacetType {
  id String @id @default(cuid())  name String  slug String @unique  sortOrder Int @default(0)
  isFilterable Boolean @default(true)  values FacetValue[]
}
model FacetValue {
  id String @id @default(cuid())
  typeId String  type FacetType @relation(fields: [typeId], references: [id], onDelete: Cascade)
  label String  slug String  swatch String?  sortOrder Int @default(0)
  products ProductFacetValue[]
  @@unique([typeId, slug])
}
model ProductFacetValue {
  productId String  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  facetValueId String  facetValue FacetValue @relation(fields: [facetValueId], references: [id], onDelete: Cascade)
  @@id([productId, facetValueId])  @@index([facetValueId])
}
model InventoryMovement {
  id String @id @default(cuid())
  variantId String  variant ProductVariant @relation(fields: [variantId], references: [id])
  delta Int  reason InventoryReason  note String?
  orderId String?  actorId String?  quantityAfter Int
  createdAt DateTime @default(now())
  @@index([variantId, createdAt])
}

// ───────────── Cart & wishlist ─────────────
model Cart {
  id String @id @default(cuid())
  userId String?  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestToken String? @unique  items CartItem[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId])
}
model CartItem {
  id String @id @default(cuid())
  cartId String  cart Cart @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId String  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  quantity Int
  @@unique([cartId, variantId])
}
model WishlistItem {
  id String @id @default(cuid())
  userId String?  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestToken String?  productId String  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, productId])  @@unique([guestToken, productId])  @@index([productId])
}

// ───────────── Orders & payments ─────────────
model Order {
  id String @id @default(cuid())
  orderNumber String @unique                                  // "<PREFIX>-2611-000123"
  userId String?  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  email String  phone String?
  status OrderStatus @default(PENDING_PAYMENT)
  currency String  subtotal Decimal @db.Decimal(14,2)  shippingTotal Decimal @db.Decimal(14,2)
  taxTotal Decimal @db.Decimal(14,2)  discountTotal Decimal @default(0) @db.Decimal(14,2)  grandTotal Decimal @db.Decimal(14,2)
  shippingAddress Json  billingAddress Json                  // snapshots
  shippingMethodName String  estimatedDeliveryFrom DateTime? estimatedDeliveryTo DateTime?
  carrier String?  trackingNumber String?  trackingUrl String?
  customerNote String?  internalNote String?
  reservedUntil DateTime?                                     // stock reservation expiry
  placedAt DateTime @default(now())  paidAt DateTime?  shippedAt DateTime?  deliveredAt DateTime?  cancelledAt DateTime?
  items OrderItem[]  events OrderStatusEvent[]  payments Payment[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([userId, placedAt]) @@index([status, placedAt]) @@index([email]) @@index([reservedUntil])
}
model OrderItem {
  id String @id @default(cuid())
  orderId String  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId String?  variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  productId String?  productName String  variantTitle String  sku String  imageUrl String?
  options Json  unitPrice Decimal @db.Decimal(14,2)  quantity Int  lineTotal Decimal @db.Decimal(14,2)
  @@index([orderId])
}
model OrderStatusEvent {
  id String @id @default(cuid())
  orderId String  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status OrderStatus  note String?  actorId String?  notified Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([orderId, createdAt])
}
model Payment {
  id String @id @default(cuid())
  orderId String  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider PaymentProvider  providerRef String  status PaymentStatus
  amount Decimal @db.Decimal(14,2)  currency String  refundedAmount Decimal @default(0) @db.Decimal(14,2)
  failureReason String?  raw Json?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@unique([provider, providerRef]) @@index([orderId])
}
model PaymentWebhookEvent {
  id String @id @default(cuid())
  provider PaymentProvider  eventId String  type String  processedAt DateTime @default(now())
  @@unique([provider, eventId])
}

// ───────────── Shipping, settings, content ─────────────
model ShippingZone {
  id String @id @default(cuid())  name String  countries String[]  isActive Boolean @default(true)
  rates ShippingRate[]
}
model ShippingRate {
  id String @id @default(cuid())
  zoneId String  zone ShippingZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  name String  price Decimal @db.Decimal(14,2)  freeOverAmount Decimal? @db.Decimal(14,2)
  minDays Int  maxDays Int  requiresSignature Boolean @default(false)  sortOrder Int @default(0)
}
model StoreSetting {                                          // singleton row id = "store"
  id String @id @default("store")
  data Json                                                   // validated by Zod StoreSettingsSchema
  updatedAt DateTime @updatedAt
}
model Banner {
  id String @id @default(cuid())
  title String  subtitle String?  ctaLabel String?  ctaUrl String?
  imageUrl String  imageAlt String  focalX Int @default(50) focalY Int @default(50)
  textTone String @default("dark")  placement String @default("HOME_HERO")
  startsAt DateTime?  endsAt DateTime?  sortOrder Int @default(0)  isActive Boolean @default(true)
}
model Article {
  id String @id @default(cuid())
  slug String @unique  title String  excerpt String  body String   // Markdown
  coverUrl String?  coverAlt String?
  authorName String  authorBio String?
  status ArticleStatus @default(DRAFT)  publishedAt DateTime?
  metaTitle String?  metaDescription String?  relatedProductIds String[]
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([status, publishedAt])
}
model ContactMessage {
  id String @id @default(cuid())
  name String  email String  phone String?  message String
  productId String?  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  userId String?  status InquiryStatus @default(NEW)  handledBy String?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([status, createdAt])
}
model SlugRedirect {
  id String @id @default(cuid())
  fromPath String @unique  toPath String  statusCode Int @default(301)  createdAt DateTime @default(now())
}
model AuditLog {
  id String @id @default(cuid())
  actorId String  actorEmail String  action String  entity String  entityId String?
  summary Json?  ip String?  createdAt DateTime @default(now())
  @@index([entity, entityId]) @@index([actorId, createdAt])
}
```

### 8.3 Raw-SQL migrations (Prisma cannot express these)

- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- Trigger maintaining `Product.searchVector` from name (weight A), SKU/category/facets (B), description (C); GIN index on it; GIN trigram index on `name`.
- `CHECK ("stockQuantity" >= 0)` on `ProductVariant`; `CHECK ("quantity" > 0)` on `CartItem`/`OrderItem`.
- Sequence `order_number_seq` used for order numbers.

### 8.4 Rules

- **DB-01** Product `minPrice/maxPrice` recomputed in the service on any variant change.
- **DB-02** A product MUST have ≥ 1 active variant to be `ACTIVE`; ≥ 1 image with alt text to be published.
- **DB-03** Category depth ≤ 2; slugs unique; `path` recomputed on rename/move (with `SlugRedirect`).
- **DB-04** Products referenced by `OrderItem` cannot be hard-deleted (enforced in service; archive instead).

### 8.5 Order state machine

```
PENDING_PAYMENT ─▶ PAID ─▶ PROCESSING ─▶ SHIPPED ─▶ DELIVERED ─▶ RETURNED ─▶ REFUNDED
      │              │          │
      ▼              ▼          ▼
  CANCELLED      CANCELLED / REFUNDED (via refund)
```

Allowed transitions are a constant map in `modules/orders/state-machine.ts`; the service rejects anything else. Cancelling restores stock via `RETURN`/`RESERVE_RELEASE` movements.

### 8.6 Inventory & checkout transaction (concurrency-safe)

1. Re-load cart variants; recompute prices, shipping, tax on the server.
2. In **one DB transaction**: for each line `UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - :qty WHERE id = :id AND "stockQuantity" >= :qty` (0 rows → `OutOfStockError`, rollback); insert `InventoryMovement(SALE_RESERVE)`; create `Order(PENDING_PAYMENT, reservedUntil = now+30m)`, `OrderItem` snapshots, first `OrderStatusEvent`.
3. Create payment with the provider using the order id as idempotency key.
4. Webhook `succeeded` → mark `PAID`, clear reservation, send emails. Webhook `failed` or cron expiry → `CANCELLED` + `RESERVE_RELEASE`.
   One-of-a-kind items (loose diamonds) use `stockQuantity = 1`.

---

## 9. API Design

### 9.1 Principles

- **Server Actions** for all UI mutations (typed, CSRF-protected by Origin/Host check; `serverActions.allowedOrigins` configured). **Route Handlers** only for things that must be HTTP endpoints: auth, webhooks, uploads, feeds, search suggestions, cron, exports, health.
- Every input validated by Zod on the server. Every action/handler: authenticate → authorise → rate-limit → validate → execute → audit → revalidate.
- JSON error shape for route handlers: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": ["…"] } } }` with correct HTTP status.

### 9.2 Route Handlers

| Method & path                                                        | Auth          | Purpose                                                                       | Notes                                      |
| -------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `ALL /api/auth/[...all]`                                             | public        | Better Auth endpoints                                                         | rate-limited per IP                        |
| `GET /api/search/suggest?q=`                                         | public        | Typeahead (products, categories, guides)                                      | min 2 chars, ≤ 8 results, edge-cache 60 s  |
| `POST /api/uploads/sign`                                             | STAFF+        | Presigned PUT for images                                                      | validates mime/size allow-list, random key |
| `POST /api/uploads/confirm`                                          | STAFF+        | Verifies object (magic bytes, dimensions), strips EXIF, creates blur data URL | rejects non-images                         |
| `POST /api/webhooks/stripe`                                          | signature     | Payment events                                                                | raw body, signature verify, idempotent     |
| `POST /api/webhooks/razorpay`                                        | signature     | Payment events                                                                | same                                       |
| `GET /api/cron/release-reservations`                                 | `CRON_SECRET` | Cancel expired `PENDING_PAYMENT`, release stock                               | every 10 min                               |
| `GET /api/cron/publish-scheduled`                                    | `CRON_SECRET` | Publish scheduled articles/banners                                            | every 15 min                               |
| `GET /api/admin/export/[orders\|customers\|products\|inventory].csv` | ADMIN/STAFF   | CSV exports                                                                   | streams, audit-logged                      |
| `GET /feeds/google-merchant.xml?token=`                              | token         | Merchant Center product feed                                                  | cached, tagged `products`                  |
| `GET /llms.txt`                                                      | public        | Optional AI discovery file (flag)                                             | generated                                  |
| `GET /api/health`                                                    | public        | Liveness + DB ping                                                            | no secrets                                 |

File-convention routes: `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx` (product/category/article/default).

### 9.3 Server Actions (by module)

| Module              | Actions (auth)                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`              | `register`, `login`, `logout`, `requestPasswordReset`, `resetPassword`, `resendVerification` (public, rate-limited)                                                                       |
| `account`           | `updateProfile`, `changePassword`, `changeEmail`, `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`, `requestAccountDeletion` (CUSTOMER)                                |
| `cart`              | `addToCart`, `updateCartItem`, `removeCartItem`, `clearCart`, `mergeGuestCart` (public)                                                                                                   |
| `wishlist`          | `toggleWishlist`, `moveWishlistToCart`, `mergeGuestWishlist` (public)                                                                                                                     |
| `checkout`          | `quoteCheckout` (shipping/tax), `createOrderAndPayment`, `retryPayment` (public/CUSTOMER)                                                                                                 |
| `orders` (customer) | `lookupGuestOrder` (public, rate-limited)                                                                                                                                                 |
| `orders` (admin)    | `updateOrderStatus`, `setTracking`, `addInternalNote`, `refundOrder` (ADMIN), `cancelOrder`, `resendOrderEmail`                                                                           |
| `catalog` (admin)   | `createProduct`, `updateProduct`, `duplicateProduct`, `archiveProduct`, `deleteProduct` (ADMIN), `bulkUpdateProducts`, `upsertVariants`, `reorderImages`, `updateImageAlt`, `deleteImage` |
| `categories`        | `createCategory`, `updateCategory`, `reorderCategories`, `deleteCategory`                                                                                                                 |
| `facets`            | `createFacetType`, `createFacetValue`, `updateFacet…`, `deleteFacet…`                                                                                                                     |
| `inventory`         | `adjustStock` (reason required), `bulkAdjust`                                                                                                                                             |
| `customers`         | `changeUserRole` (ADMIN)                                                                                                                                                                  |
| `content`           | `createBanner/updateBanner/deleteBanner`, `createArticle/updateArticle/deleteArticle`                                                                                                     |
| `enquiries`         | `submitEnquiry` (public, rate-limited, honeypot + time-trap), `updateEnquiryStatus`, `replyToEnquiry`                                                                                     |
| `settings`          | `updateStoreSettings`, `upsertShippingZone`, `upsertShippingRate`, `deleteShippingRate` (ADMIN)                                                                                           |

### 9.4 Rate limits (per IP + identifier)

Login 5/min · register 3/min · password reset 3/15 min · guest order lookup 5/min · enquiry 3/10 min · search suggest 60/min · add-to-cart 60/min · upload sign 30/min · webhooks excluded (signature-verified).

---

## 10. Folder Structure & Module Guide

```
<repo>/
├─ PROJECT_REQUIREMENTS.md          ← this file (source of truth)
├─ AGENTS.md                        ← version-matched Next.js docs pointer (auto-maintained by next dev) + project rules
├─ README.md                        ← setup, scripts, how to run tests
├─ next.config.ts                   ← images, headers, redirects, cacheComponents, reactCompiler, serverActions origins
├─ proxy.ts                         ← coarse auth redirects, CSP nonce, canonical host (NOT the only authorisation)
├─ tsconfig.json  eslint.config.mjs  prettier.config.mjs  commitlint.config.mjs
├─ components.json                  ← shadcn/ui config
├─ docker-compose.yml               ← Postgres + MinIO + Mailpit + Redis for local dev
├─ Dockerfile                       ← standalone production image
├─ .env.example                     ← every variable documented (§19.2)
├─ prisma/
│  ├─ schema.prisma                 ← §8.2
│  ├─ migrations/                   ← incl. raw SQL (FTS, trigram, checks, sequence)
│  └─ seed.ts                       ← prod seed: admin user, settings, base facets; dev seed (SEED_DEMO_DATA=true): sample catalogue
├─ content/                         ← MDX: privacy, terms, shipping-returns, care guide, size guide
├─ public/                          ← favicons, logo, static brand assets (no product images here)
├─ docs/                            ← ADRs (architecture decision records), runbooks
├─ tests/
│  ├─ unit/  integration/           ← Vitest
│  └─ e2e/                          ← Playwright (storefront, checkout, admin, a11y, seo)
└─ src/
   ├─ app/
   │  ├─ layout.tsx                 ← root: fonts, ThemeProvider, metadataBase, JSON-LD Organization/WebSite, consent
   │  ├─ globals.css                ← imports styles/*
   │  ├─ sitemap.ts  robots.ts  manifest.ts  not-found.tsx  error.tsx  global-error.tsx  opengraph-image.tsx
   │  ├─ llms.txt/route.ts          ← optional generated file
   │  ├─ feeds/google-merchant.xml/route.ts
   │  ├─ (storefront)/              ← public layout (header, footer, cart drawer)
   │  │  ├─ page.tsx                          ← home
   │  │  ├─ collections/[[...slug]]/page.tsx  ← all products + category pages
   │  │  ├─ products/[slug]/page.tsx          ← PDP (+ opengraph-image.tsx)
   │  │  ├─ search/page.tsx                   ← noindex results
   │  │  ├─ guides/page.tsx  guides/[slug]/page.tsx
   │  │  ├─ cart/page.tsx  wishlist/page.tsx
   │  │  ├─ checkout/page.tsx  checkout/success/[orderNumber]/page.tsx
   │  │  ├─ orders/track/page.tsx  orders/track/[orderNumber]/page.tsx
   │  │  └─ (pages)/about  contact  faq  shipping-returns  privacy  terms  care-guide  ring-size-guide
   │  ├─ (auth)/login  register  forgot-password  reset-password  verify-email
   │  ├─ (account)/account/page.tsx  profile  addresses  orders  orders/[orderNumber]  wishlist
   │  ├─ admin/
   │  │  ├─ layout.tsx              ← requireRole(STAFF+), admin shell, noindex
   │  │  ├─ page.tsx                ← dashboard
   │  │  ├─ products/  products/new  products/[id]
   │  │  ├─ categories/  attributes/  inventory/
   │  │  ├─ orders/  orders/[id]
   │  │  ├─ customers/  customers/[id]
   │  │  ├─ banners/  articles/  articles/[id]  enquiries/
   │  │  └─ settings/  audit-log/
   │  └─ api/                       ← §9.2
   ├─ modules/                      ← one folder per domain
   │  ├─ catalog/      queries.ts  actions.ts  service.ts  schemas.ts  filters.ts  components/
   │  ├─ categories/   facets/   inventory/   cart/   wishlist/   checkout/   orders/ (state-machine.ts)
   │  ├─ customers/    account/  auth/       content/ (banners, articles)   enquiries/   settings/   search/   analytics/
   ├─ server/                       ← `import 'server-only'`
   │  ├─ db.ts                      ← Prisma singleton (driver adapter)
   │  ├─ auth.ts                    ← Better Auth config
   │  ├─ dal.ts                     ← getSession, verifySession, requireRole, requireUser
   │  ├─ create-action.ts           ← action wrapper (§4.4)
   │  ├─ payments/                  ← provider.ts (interface), stripe.ts, razorpay.ts, index.ts
   │  ├─ storage/                   ← s3.ts, image-pipeline.ts (magic-bytes, EXIF strip, blur)
   │  ├─ email/                     ← client.ts, send.ts
   │  ├─ rate-limit.ts  audit.ts  logger.ts  errors.ts  cache-tags.ts
   ├─ components/
   │  ├─ ui/                        ← shadcn primitives (Button, Dialog, Sheet, Tabs, Select, Table…)
   │  ├─ layout/                    ← Header, MegaMenu, MobileNav, Footer, AnnouncementBar, ThemeSwitcher, Breadcrumbs
   │  ├─ shared/                    ← Price, Rating-free stat blocks, EmptyState, Pagination, ResponsiveDataTable, ConfirmDialog, FormField
   │  ├─ seo/                       ← JsonLd, Seo helpers
   │  └─ admin/                     ← AdminShell, PageHeader, DataTable, StatCard, ImageUploader, RichMarkdownEditor, StatusBadge
   ├─ lib/
   │  ├─ env.ts  constants.ts  utils.ts  money.ts  format.ts  slug.ts  permissions.ts  dates.ts
   │  └─ seo/ site-config.ts  metadata.ts  jsonld/ (organization, website, product, breadcrumb, itemlist, article, merchant-return-policy)  robots-policy.ts
   ├─ styles/  tokens.css  theme.css  base.css  utilities.css            ← §12
   ├─ hooks/  use-media-query.ts  use-debounce.ts  use-recently-viewed.ts …
   ├─ emails/ OrderConfirmation.tsx  OrderShipped.tsx  OrderDelivered.tsx  VerifyEmail.tsx  ResetPassword.tsx  EnquiryReceived.tsx
   └─ types/
```

### 10.1 Important files explained

| File                               | Responsibility                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy.ts`                         | Optimistic redirect of anonymous users away from `/account` & `/admin`, sets CSP nonce, enforces canonical host/HTTPS. Never the sole gate. |
| `server/dal.ts`                    | The **only** place that reads the session. `requireRole()` throws `ForbiddenError`; used by every admin page/action.                        |
| `server/create-action.ts`          | Uniform pipeline for all server actions (validation, authz, rate limit, audit, result type).                                                |
| `modules/checkout/service.ts`      | Re-pricing, stock reservation transaction, order creation, payment handoff. Heavily unit/integration tested.                                |
| `modules/orders/state-machine.ts`  | Single source for allowed status transitions and side effects.                                                                              |
| `modules/catalog/filters.ts`       | Parses/serialises filter URL state (nuqs parsers), builds Prisma `where`/raw FTS, produces canonical URLs.                                  |
| `server/payments/provider.ts`      | `PaymentProvider` interface: `createPayment`, `verifyWebhook`, `refund`, `getStatus`.                                                       |
| `server/storage/image-pipeline.ts` | Validates, normalises (sharp), strips EXIF, records dimensions/blur.                                                                        |
| `lib/seo/metadata.ts`              | `buildMetadata({title, description, path, image, noindex})` — canonical, OG, Twitter, robots in one place.                                  |
| `lib/seo/jsonld/*`                 | Typed (`schema-dts`) JSON-LD builders; `<JsonLd>` escapes `<` as `\u003c`.                                                                  |
| `app/sitemap.ts`                   | Segmented sitemaps (`generateSitemaps`) with real `lastModified` and image entries.                                                         |
| `styles/tokens.css`                | All colour/spacing/radius/shadow tokens for light + dark.                                                                                   |

---

## 11. UI/UX Design System

### 11.1 Brand feel

Quiet luxury: generous whitespace, editorial photography, hairline gold details, restrained motion. Inspiration: international fine-jewellery maisons — calm grids, large imagery, serif display headings, uncluttered product pages. **No blue or purple anywhere** (including links, focus rings, selection, form controls, payment widgets, charts, and error/info states).

### 11.2 Colour palette (tokens in §12.2)

| Role                                                                                    | Light                            | Dark                                 |
| --------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| Background (ivory / warm charcoal)                                                      | `#FAF7F0`                        | `#15110E`                            |
| Surface / card                                                                          | `#FFFDF8`                        | `#1D1814`                            |
| Muted surface (beige)                                                                   | `#F1EADC`                        | `#261F1A`                            |
| Foreground (charcoal / champagne-ivory)                                                 | `#2A2522`                        | `#F4ECDD`                            |
| Muted text                                                                              | `#6A5F55`                        | `#B8AB98`                            |
| Border / input                                                                          | `#E3D8C4` / `#D9CCB4`            | `#3B322A` / `#483D33`                |
| Primary (button)                                                                        | charcoal `#2A2522` on ivory text | champagne `#E6D3A8` on charcoal text |
| Secondary (champagne)                                                                   | `#EADFC8`                        | `#2E261F`                            |
| Accent gold (non-text, hairlines, icons)                                                | `#A8844A`                        | `#C9A46A`                            |
| Accent text (bronze)                                                                    | `#7A5A2E`                        | `#D9B67E`                            |
| Focus ring                                                                              | gold `#A8844A`                   | `#C9A46A`                            |
| Destructive (terracotta)                                                                | `#A8402F`                        | `#E07A66`                            |
| Success (sage/olive)                                                                    | `#4F6B3F`                        | `#9DB88A`                            |
| Warning (amber-bronze)                                                                  | `#9A6A12`                        | `#D9A441`                            |
| Decorative gold hairline gradient: `linear-gradient(90deg, #8A6A3B, #D9BC82, #8A6A3B)`. |

**Contrast rule (A11Y-01):** body/UI text ≥ 4.5:1, large text and meaningful non-text ≥ 3:1. Gold is **never** used for small text on ivory — use the bronze "accent text" token. Contrast is verified by an automated token-pair test in CI for both themes.

### 11.3 Typography

- Display/headings: **Cormorant Garamond** (500/600) via `next/font` — used ≥ 28 px for legibility.
- Body/UI: **Jost** (400/500) — clean geometric sans; tabular numerals for prices.
- Fluid scale with `clamp()`: `--text-xs … --text-6xl`; body 16–17 px, line-height 1.6; headings 1.1–1.2, slight positive letter-spacing on uppercase labels (0.12em).
- Fonts self-hosted by `next/font`, `display: swap`, subset to Latin (+ needed extensions), fallback stacks metric-adjusted to avoid CLS.

### 11.4 Layout, spacing, shape

- Container max 1440 px, side padding 16 (mobile) / 32 (tablet) / 48 (desktop). 8-pt spacing scale.
- Radii: small 2 px (buttons/inputs keep a crisp, jewellery-case feel), cards 4 px, pills only for chips/badges.
- Elevation: warm-tinted soft shadows (`rgba(42,37,34,.08)`); in dark mode prefer borders over shadows.
- Image ratios: product cards 4:5, gallery 1:1 + 4:5 hero, banners 21:9 (desktop) / 4:5 (mobile) with focal point.

### 11.5 Motion

Fade/slide 200–300 ms ease-out; image zoom on hover (desktop only); drawer slide; skeleton shimmer. All motion disabled/reduced under `prefers-reduced-motion`. No auto-playing carousels.

### 11.6 Component inventory (reusable, built once)

Button (primary/secondary/ghost/link/destructive, sizes, loading), IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Slider (price range), Tabs, Accordion, Dialog, Sheet/Drawer, Popover, Tooltip, DropdownMenu, Toast, Badge, Card, Skeleton, Breadcrumbs, Pagination, Table/DataTable (responsive → cards), EmptyState, Stepper, Gallery, Price, QuantityStepper, VariantSelector, FilterPanel (sidebar desktop / sheet mobile), ProductCard, CategoryTile, Hero, Timeline, StatCard, ImageUploader, MarkdownEditor, ConfirmDialog, ThemeSwitcher, CookieBanner.

### 11.7 Page layout guidance (desktop → mobile)

- **Home:** full-bleed hero → category tiles (4 → 2 columns) → featured (carousel → swipe) → story block (split image/text → stacked) → trust strip → new arrivals → guides.
- **PLP:** sidebar filters (280 px) + 3–4 column grid → mobile 2-column grid with sticky "Filter & Sort" bar and bottom sheet.
- **PDP:** gallery (left, thumbnails vertical) + sticky buy box (right) → mobile: swipe gallery, content stacked, **sticky bottom Add-to-cart bar**.
- **Checkout:** two columns (form + summary) → mobile single column with collapsible summary.
- **Admin:** sidebar + content, dense tables → mobile bottom-sheet nav, cards.

### 11.8 Responsiveness (UX-30)

Design baseline 360 px; breakpoints `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. Mandatory viewport test matrix (Playwright): 360×740, 390×844, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 — no horizontal scroll, no overlapping UI, tap targets ≥ 44 px, safe-area insets respected.

### 11.9 Accessibility (WCAG 2.2 AA)

Semantic landmarks, skip link, visible focus (gold ring, 2 px offset), full keyboard operation (menus, dialogs, galleries, filters), ARIA only where native fails, form labels/errors linked via `aria-describedby`, live regions for cart/toast updates, image alt text required in admin, reduced motion, 200 % zoom without loss, `forced-colors` support, axe-core checks on key pages in CI (zero serious/critical violations).

---

## 12. CSS & Theme Architecture

### 12.1 Approach

Tailwind v4 utilities for layout/spacing; **CSS custom properties are the single source of design values**; shadcn components consume semantic tokens only (`bg-background`, `text-foreground`, `border-border`…). **No raw hex values in components** (lint rule + grep check in CI).

### 12.2 File layout

```
src/styles/
  tokens.css     ← raw values: --gold-500, --ivory-50, spacing, radii, shadows, z-index, motion durations
  theme.css      ← semantic tokens for :root (light) and .dark, plus @theme inline mapping to Tailwind
  base.css       ← resets, typography defaults, focus ring, selection colour (champagne), scrollbar, prefers-reduced-motion
  utilities.css  ← @utility rules (e.g. .gold-hairline, .container-page, .text-balance, .safe-area-pb)
src/app/globals.css  → @import "tailwindcss"; @import "../styles/tokens.css"; … theme.css; base.css; utilities.css;
```

### 12.3 Token skeleton (excerpt — full set in `theme.css`)

```css
@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;
  --background: #faf7f0;
  --foreground: #2a2522;
  --card: #fffdf8;
  --card-foreground: #2a2522;
  --muted: #f1eadc;
  --muted-foreground: #6a5f55;
  --border: #e3d8c4;
  --input: #d9ccb4;
  --primary: #2a2522;
  --primary-foreground: #faf7f0;
  --secondary: #eadfc8;
  --secondary-foreground: #2a2522;
  --accent: #a8844a;
  --accent-text: #7a5a2e;
  --ring: #a8844a;
  --destructive: #a8402f;
  --success: #4f6b3f;
  --warning: #9a6a12;
  --shadow-soft: 0 1px 2px rgb(42 37 34 / 0.06), 0 8px 24px rgb(42 37 34 / 0.06);
  --radius: 2px;
}
.dark {
  color-scheme: dark;
  --background: #15110e;
  --foreground: #f4ecdd;
  --card: #1d1814;
  --card-foreground: #f4ecdd;
  --muted: #261f1a;
  --muted-foreground: #b8ab98;
  --border: #3b322a;
  --input: #483d33;
  --primary: #e6d3a8;
  --primary-foreground: #1a1511;
  --secondary: #2e261f;
  --secondary-foreground: #f4ecdd;
  --accent: #c9a46a;
  --accent-text: #d9b67e;
  --ring: #c9a46a;
  --destructive: #e07a66;
  --success: #9db88a;
  --warning: #d9a441;
  --shadow-soft: 0 0 0 1px rgb(244 236 221 / 0.06);
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-accent: var(--accent);
  --color-accent-text: var(--accent-text);
  --color-ring: var(--ring);
  --font-display: var(--font-cormorant), ui-serif, Georgia, serif;
  --font-sans: var(--font-jost), ui-sans-serif, system-ui, sans-serif;
}
```

### 12.3.1 Rules

- Components use semantic tokens only; new colours require a token + dark value + contrast test.
- Variants via `class-variance-authority` (`cva`); class merging via `tailwind-merge` (`cn()` helper).
- Prefer layout primitives (`Container`, `Stack`, `Grid`, `Section`) over repeating utility strings.
- Third-party widgets (Stripe Elements `appearance`, Razorpay `theme.color`, Recharts, Sonner, embla) are configured from the same tokens at runtime.
- Selection and caret colours set to champagne/gold; **default browser blue is overridden** for `accent-color`, `::selection`, and autofill (`-webkit-autofill` box-shadow trick).

### 12.4 Admin theming

Admin reuses the same tokens with denser spacing (`data-density="compact"` on the admin shell) and a flatter, neutral look; same theme switcher and persistence.

### 12.5 Theme switcher specification (UX-10…UX-14)

- **UX-10** Three modes: Light, Dark, System (default). Stored in `localStorage` (`theme`) by `next-themes`; `<html class>` toggled before paint (inline script) → no flash; `suppressHydrationWarning` on `<html>`.
- **UX-11** Switcher is an accessible menu button (icon sun/moon/monitor with labels), keyboard operable, present in header, mobile drawer, footer, and admin top bar.
- **UX-12** `<meta name="theme-color">` per scheme (`#FAF7F0` / `#15110E`); `color-scheme` set so native controls/scrollbars match.
- **UX-13** Images/illustrations legible in both themes (transparent PNG/SVG logos have dark/light variants; product photography is never tinted).
- **UX-14** Both themes pass identical contrast and visual-regression snapshots (Playwright screenshots for key pages in light and dark).

---

## 13. SEO Specification

### 13.1 Rendering & crawlability

- **SEO-01** All indexable content (copy, prices, specs, links, structured data) present in initial server-rendered HTML. No content gated behind clicks that require JS to fetch.
- **SEO-02** Internal links are real `<a href>` (via `next/link`); filters/pagination use crawlable links.
- **SEO-03** Correct HTTP status codes: 200, 301/308 redirects, real 404 (`notFound()`), 410 for permanently removed with no replacement, 5xx only for real errors. No soft 404s.

### 13.2 Metadata (Metadata API only)

- **SEO-04** `metadataBase` = production origin. Title template `%s | <BRAND>`.
- **SEO-05** Every route exports `generateMetadata` (or static metadata) using `buildMetadata()`: unique `title`, `description`, `alternates.canonical`, `openGraph` (type, url, title, description, images 1200×630, siteName, locale), `twitter` (summary_large_image), `robots`.
- **SEO-06** Patterns (admin-overridable per entity):
  - Product: `{Name} — {Metal/Stone key attr} | <BRAND>`; description = first benefit + key specs + trust cue (certified, insured delivery, returns).
  - Category: `{Category} — {Qualifier} | <BRAND>`; description from intro copy.
  - Guide: `{Title}`; description = excerpt.
  - Titles ≤ ~60 chars, descriptions ≤ ~155 chars as authoring guidance with live meters in admin (Google may rewrite them; they must still be unique and accurate).
- **SEO-07** Robots meta: indexable pages `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` (snippet eligibility). `noindex` on: cart, checkout, account, auth pages, order tracking, internal search, admin, filtered/sorted combinations beyond the canonical set.
- **SEO-08** Exactly one `<h1>` per page; logical heading hierarchy; descriptive link text.

### 13.3 Canonicals, URLs, duplicates

- **SEO-09** URL scheme (lowercase, hyphenated, no IDs, no trailing slash):
  `/` · `/collections` · `/collections/{category}` · `/collections/{category}/{subcategory}` · `/products/{keyword-rich-slug}` · `/guides/{slug}` · static pages at root.
- **SEO-10** Canonical rules: self-canonical for clean URLs and for each paginated page (`?page=n`, n>1); sort/filter/utm/variant parameters canonicalise to the clean category/product URL; variant deep links canonicalise to the product URL (or to the variant URL only if variants have distinct indexable content — default: product URL).
- **SEO-11** Single canonical host (apex or `www`), HTTPS-only, HSTS; all alternates 308/301 to it.
- **SEO-11a** Slug changes and category moves create `SlugRedirect` (301). Archived product → 301 to its category; removed with no relevant target → 410.

### 13.4 Structured data (JSON-LD, server-rendered, typed via `schema-dts`)

| Page            | Types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every page      | `Organization` (name, url, logo, sameAs, contactPoint, **`hasMerchantReturnPolicy`**) + `WebSite` (name, url)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Product         | `Product` or `ProductGroup` + `hasVariant` (when variants), with `name, description, image[] (multiple ratios), sku, mpn/gtin where known, brand, material, color/size, category, url`, `offers` → `Offer` (`price, priceCurrency, availability (InStock/OutOfStock/BackOrder/PreOrder), itemCondition, url, seller`, **`shippingDetails` (OfferShippingDetails: rate, destination, handling + transit time)**, **`hasMerchantReturnPolicy`**). Omit price/Offer for price-on-request. Diamonds add `additionalProperty` (`PropertyValue`) for carat, cut, colour, clarity, certificate. `aggregateRating`/`review` **only when real, visible reviews exist** (Phase 2). |
| Category        | `CollectionPage` + `ItemList` (positions, URLs) + `BreadcrumbList`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Guide           | `Article` (headline, image, datePublished, dateModified, author `Person` with url/bio, publisher) + `BreadcrumbList`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Contact / About | `ContactPage` / `AboutPage`; `JewelryStore` (address, geo, openingHours, telephone) **only if a physical store is configured**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| FAQ page        | Visible FAQ content; `FAQPage` optional, not relied upon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

- **SEO-12** Markup must match visible page content exactly (price, availability, name). Single source: the same product view-model feeds UI and JSON-LD.
- **SEO-13** `<JsonLd>` component serialises with `<` escaped as `\u003c` (XSS-safe).
- **SEO-14** CI test validates every JSON-LD builder output against required/recommended properties; manual spot-check with Google Rich Results Test before launch.
- **SEO-15** Search Console shipping & returns settings (if used) MUST mirror on-page markup, since Search Console settings take precedence.
- **SEO-16** Merchant Center: free listings enabled; `/feeds/google-merchant.xml` provides id, title, description, link, image_link, additional_image_link, availability, price, brand, gtin/mpn (or `identifier_exists=false`), condition, google_product_category, product_type, material, color, size, shipping weight. Feed regenerated on catalogue change (tag-invalidated).

### 13.5 Sitemaps & robots

- **SEO-17** `app/sitemap.ts` with `generateSitemaps()` segments (static, categories, products, guides), each ≤ 50 000 URLs; **real `lastModified` only** (no fake dates; `priority`/`changefreq` omitted — Google ignores them); product entries include image URLs. Only indexable, canonical, 200-status URLs.
- **SEO-18** `app/robots.ts`: allow `/`; disallow `/admin`, `/api`, `/cart`, `/checkout`, `/account`, `/orders`, `/_next/` internals except assets as needed; sitemap index URL declared. Internal search results are left crawlable with `noindex,follow` so the directive is seen (not blocked in robots).
- **SEO-19** Sitemap submitted to Search Console; Merchant Center and Bing Webmaster Tools verified (env-driven verification tags).

### 13.6 Image SEO

- **SEO-20** All images through `next/image` (AVIF/WebP, responsive `sizes`, explicit width/height, lazy by default). LCP image preloaded (`preload` in Next 16; `priority` is deprecated — confirm in bundled docs).
- **SEO-21** Descriptive, hyphenated file names generated from product slug; **alt text mandatory** and descriptive (material, stone, style — not keyword stuffing); decorative images `alt=""`.
- **SEO-22** Multiple angles per product, consistent crops (1:1, 4:5), sufficiently large originals (≥ 1600 px long edge) for Google Images/Lens; image URLs stable (no query-string churn); images included in sitemap.

### 13.7 Internal linking

- **SEO-23** Breadcrumbs (UI + JSON-LD) everywhere; mega-menu and footer link to all top categories, guides, policies; PDP links to category, parent category, related products, relevant guides (and guides link back to products); category pages link to subcategories and top products; "recently viewed"/"complete the look" modules.
- **SEO-24** No orphan pages: CI script crawls the built site and diffs reachable URLs vs sitemap; fails on orphans and on broken internal links.
- **SEO-25** Descriptive anchor text; no `rel="nofollow"` on internal links; user-generated or external untrusted links use `rel="ugc nofollow"`.

### 13.8 Technical SEO & monitoring

- **SEO-26** CDN/WAF/bot-protection rules allow Googlebot/Bingbot (verified by reverse DNS) and chosen AI retrieval agents; documented in runbook.
- **SEO-27** Mobile-first parity (same content/markup on mobile and desktop), viewport meta, tap-target sizing.
- **SEO-28** Core Web Vitals budgets (§15). `hreflang` not required (single locale) but locale config is centralised for later.
- **SEO-29** Search Console + GA4 (consent-gated) set up; weekly monitoring checklist: coverage, sitemaps, rich-result reports (Product snippets, Merchant listings), CWV, manual actions, generative-AI insights when available.
- **SEO-30** Content quality rules: unique descriptions per product (no manufacturer duplicates), no thin pages, no doorway pages, no hidden text, no cloaking, no bulk unreviewed AI-generated copy.

---

## 14. AI SEO / AEO / GEO Specification

Principle (from Google's own 2026 guidance): **AI visibility = strong SEO + unique, trustworthy, easy-to-extract content + structured/merchant data.** No tricks.

### 14.1 Eligibility foundations

- **AI-01** Every indexable page is indexed and snippet-eligible (no `nosnippet`/over-restrictive `max-snippet` on indexable pages).
- **AI-02** Server-rendered content (no JS-dependency) so retrieval bots that don't execute scripts still see prices, specs, and answers.
- **AI-03** `robots.txt` and CDN/WAF policy explicitly handled for crawlers. Default policy (editable in Settings → AI crawler policy, generated by `lib/seo/robots-policy.ts`):
  - **Allow** search/retrieval agents: Googlebot, Bingbot, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`.
  - **Training crawlers** (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`): business decision, default **allow**; toggling to block writes the corresponding `Disallow` rules. Verify user-agent names against each vendor's current documentation at implementation time.

### 14.2 Answer-first, extractable content (AEO)

- **AI-04** Every guide and category intro opens with a **direct 40–60-word answer** to the page's primary question, followed by depth. Headings phrased as the questions shoppers ask ("How much does a 1-carat diamond cost?", "Lab-grown vs natural diamonds").
- **AI-05** Machine-readable specifics: spec tables (HTML `<table>`), consistent units, explicit price ranges and ring-size/carat-weight charts, definitions of 4Cs in plain language, comparison tables.
- **AI-06** Visible FAQ blocks on key categories, PDPs, shipping/returns (real questions from enquiries); FAQ markup optional.
- **AI-07** Fresh and dated: `datePublished` + `dateModified` visible and in JSON-LD; guides reviewed at least twice yearly.

### 14.3 Unique, expert, trustworthy content (GEO)

- **AI-08** "Non-commodity" content plan: original product photography and macro shots, certification details, craftsmanship/sourcing story, gemologist-authored guides with author bios and credentials, transparent pricing logic, real customer enquiries turned into FAQs.
- **AI-09** Entity clarity: consistent brand name, address/phone, social profiles (`sameAs`), About page with company facts, Organization JSON-LD, optional `JewelryStore` with geo/hours, consistent profiles on Google Business Profile and major directories.
- **AI-10** Citation-friendly facts: each guide includes sourced statistics with links to authoritative references; quotable summary boxes ("Key takeaways").

### 14.4 Commerce data for AI shopping surfaces

- **AI-11** Complete Product/Offer/ProductGroup JSON-LD + Merchant Center feed + shipping/returns data (§13.4, SEO-16): identifiers (GTIN/MPN/SKU), brand, material, colour, size, availability, price, condition.
- **AI-12** Stable canonical product URLs and variant parameters; price/availability in HTML kept in sync with feed (feed refresh on every stock/price change).
- **AI-13** Clean, label-correct forms with `autocomplete` and semantic markup so automated agents and assistive tech can operate cart/checkout; guest checkout available.

### 14.5 Discovery files

- **AI-14** `/llms.txt` generated from top categories/guides/policies (flag `ENABLE_LLMS_TXT`, default on). Documented as low-cost and unproven; Google does not require it.
- **AI-15** No hidden "AI-only" text or cloaked content, ever.

### 14.6 Measurement

- **AI-16** GA4 custom channel group "AI assistants" matching referrers (e.g., chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai); server-log report of AI-bot hits per URL (sampled, no PII); Search Console generative-AI insights when available; monthly manual prompt audit (20 priority shopper questions across major AI assistants; record whether brand/products are cited).
- **AI-17** Landing-page review of AI-referred sessions feeds the guide/FAQ backlog.

### 14.7 Watch-list (not built in v1)

Agentic commerce checkout protocols and "agent-readable" product APIs; reassess each quarter and record in the Decision Log.

---

## 15. Performance

- **PERF-01** Targets (p75, mobile 4G): LCP ≤ 2.5 s (goal ≤ 2.0 s), INP ≤ 200 ms, CLS ≤ 0.1, TTFB ≤ 0.8 s. Lighthouse mobile: Performance ≥ 95, Accessibility ≥ 95, Best Practices 100, SEO 100 on Home, PLP, PDP.
- **PERF-02** Default to Server Components; `'use client'` only for interactivity (gallery, filters, drawers, forms). Initial JS ≤ 150 KB gzip on storefront routes (CI bundle budget via `@next/bundle-analyzer`/Lighthouse CI).
- **PERF-03** Images: `next/image`, AVIF/WebP, correct `sizes`, no layout shift (reserved aspect ratios), blur placeholders, lazy-load below the fold, hero preloaded; originals stored ≥ 1600 px, served resized; CDN-cached with long TTL + immutable.
- **PERF-04** Fonts via `next/font` (self-hosted, subset, `swap`, size-adjusted fallbacks); max 2 families, ≤ 4 weights.
- **PERF-05** Streaming + Suspense for personalised/slow parts; skeletons match final layout; link prefetch tuned (Next 16.3 reduced prefetch payloads); `Instant Navigations` features evaluated and adopted if stable.
- **PERF-06** Database: indexed queries, no N+1 (Prisma `select`/`include` audited), cursor/offset pagination limits, connection pooling (pooler URL), slow-query logging > 200 ms.
- **PERF-07** Third-party scripts minimal and deferred; analytics only post-consent; payment scripts only on checkout.
- **PERF-08** HTTP caching: immutable hashed assets, tagged data cache, CDN `s-maxage` + `stale-while-revalidate` on cacheable routes; compression (Brotli).
- **PERF-09** React Compiler on; avoid unnecessary context re-renders; virtualise very long admin tables if needed.
- **PERF-10** Performance regression gate: Lighthouse CI on PRs touching UI (fail below budgets).

---

## 16. Security & Privacy

### 16.1 Authentication & sessions

- **SEC-01** Better Auth: scrypt/argon2-class password hashing, email verification required before checkout-linked account features, secure session cookies (`HttpOnly`, `Secure`, `SameSite=Lax`, rotated on login/role change), session expiry 30 days sliding, "sign out everywhere".
- **SEC-02** **Defence in depth authorisation:** `proxy.ts` (optimistic) → layout-level `requireRole` → action/handler-level `requireRole` → data-level ownership checks (`where: { id, userId }`). Never rely on the proxy alone (CVE-2025-29927 lesson).
- **SEC-03** Brute-force protection: rate limits (§9.4), progressive delay, generic auth errors (no account enumeration), password-reset tokens single-use and short-lived.
- **SEC-04** Admin accounts: strong-password policy; optional TOTP 2FA (Better Auth plugin) **recommended for ADMIN** and enforced via setting.

### 16.2 Input, output, data

- **SEC-05** Server-side Zod validation on every action/handler; reject unknown keys (`.strict()`).
- **SEC-06** SQL injection: Prisma parameterised queries only; any raw SQL uses `Prisma.sql` tagged templates.
- **SEC-07** XSS: React escaping; Markdown rendered with a sanitising pipeline (`rehype-sanitize`, no raw HTML); JSON-LD `<` escaping; strict CSP.
- **SEC-08** CSRF: server actions Origin/Host verification + SameSite cookies; route handlers that mutate require same-origin or signed tokens.
- **SEC-09** Uploads: allow-list (JPEG/PNG/WebP/AVIF), magic-byte check, size cap, re-encode with `sharp`, strip EXIF/GPS, random storage keys, private bucket with public-read only via CDN prefix; presigned URLs expire ≤ 5 min.
- **SEC-10** Payments: card data never touches our servers (Stripe Elements / Razorpay Checkout); webhook signature verification + idempotency; prices/stock re-computed server-side; amounts compared with provider amount before marking `PAID`.
- **SEC-11** Secrets only in env (validated at boot), never in client bundles (`NEXT_PUBLIC_` only for public values); separate keys per environment; rotate on staff change.
- **SEC-12** Security headers (via `next.config.ts` / `proxy.ts`): `Content-Security-Policy` (nonce-based; start in report-only, enforce after tuning for Stripe/Razorpay/GA/Sentry domains), `Strict-Transport-Security` (2 years, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation off; payment on checkout only), `frame-ancestors 'none'` (+ `X-Frame-Options: DENY`), `Cross-Origin-Opener-Policy: same-origin`.
- **SEC-13** Dependency hygiene: lockfile, Renovate weekly, `npm audit`/OSV scan in CI, patch Next.js within 7 days of each security release, pinned GitHub Actions by SHA.
- **SEC-14** Abuse controls: honeypot + timing check on public forms, Upstash rate limits, optional Cloudflare Turnstile (env-gated; neutral theme).
- **SEC-15** Admin safety: destructive actions require confirmation; audit log immutable (no update/delete endpoints); role changes logged; last admin cannot be removed.
- **SEC-16** Backups: daily automated PostgreSQL backups with point-in-time recovery; quarterly restore drill; storage bucket versioning.

### 16.3 Privacy & compliance

- **SEC-17** Data minimisation; PII only in `User`, `Address`, `Order`, `ContactMessage`. Logs and Sentry scrub emails/addresses/tokens.
- **SEC-18** Cookie consent with granular choices; GA4 and any marketing tags fire only after consent; strictly-necessary cookies (session, cart, theme, consent) documented in Privacy page.
- **SEC-19** Account export/deletion flow (anonymise user + addresses, retain order financial records as required by law).
- **SEC-20** Privacy Policy, Terms, Shipping & Returns pages reviewed by the business owner/legal before launch.

---

## 17. Error Handling & Observability

- **Boundaries:** `error.tsx` per route group, `global-error.tsx`, branded `not-found.tsx`; admin has its own error UI. Users see friendly messages with a retry and reference ID; stack traces never leave the server.
- **Expected failures** (validation, out-of-stock, payment declined) return typed `ActionResult` errors rendered inline (field errors next to inputs, banner for form-level).
- **Unexpected failures** → `logger.error` (pino, JSON) + Sentry with request ID, user ID hash, route; PII scrubbed.
- **Webhook failures** return 5xx so providers retry; idempotency prevents double processing.
- **Health & alerts:** `/api/health`; uptime monitor; alerts on error-rate spikes, failed webhooks, payment-success-rate drop, cron failures, low disk/DB limits.
- **Business events logged:** order placed/paid/failed/cancelled/refunded, stock adjustments, role changes, settings changes.

---

## 18. Testing & QA

| Level         | Tooling                                             | Must cover                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit          | Vitest                                              | money math, tax/shipping calculators, state machine, slug/URL/canonical builders, filter parsers, permission map, JSON-LD builders, token contrast pairs, robots policy                                                   |
| Integration   | Vitest + test Postgres (Docker)                     | checkout transaction (stock race, rollback), webhook idempotency, order status transitions, inventory ledger consistency, auth/role guards on every action                                                                |
| E2E           | Playwright (Chromium, WebKit, Firefox smoke)        | guest & account checkout (provider test mode), register/verify/login/reset, wishlist/cart merge, search & filters, order tracking, admin CRUD for products/categories/images/orders/customers/settings, role restrictions |
| Accessibility | axe-core in Playwright                              | zero serious/critical on key pages, both themes                                                                                                                                                                           |
| Visual        | Playwright screenshots                              | key pages × (light, dark) × (mobile, tablet, desktop)                                                                                                                                                                     |
| SEO           | Playwright + custom scripts                         | titles/descriptions unique, canonicals, robots meta, JSON-LD validity, sitemap URLs return 200 & indexable, no orphans/broken links, 404 status                                                                           |
| Performance   | Lighthouse CI                                       | budgets in PERF-01/02                                                                                                                                                                                                     |
| Security      | ZAP baseline / header check in CI, dependency audit | headers, cookie flags, auth bypass attempts                                                                                                                                                                               |

- **Coverage gate:** ≥ 85 % statements on `modules/**/service.ts`, `lib/**`, `server/**`.
- **Definition of Done (per feature):** typed, validated, authorised, responsive (7 viewports), both themes, accessible, SEO-complete where public, empty/loading/error states, tests added, docs updated, no TODO/placeholder UI.

---

## 19. Deployment & DevOps

### 19.1 Environments

`local` (docker-compose: Postgres, Redis, MinIO, Mailpit) → `preview` (per PR, isolated DB branch) → `staging` (prod-like, provider test mode, `noindex` + basic auth) → `production`.

### 19.2 Environment variables (`.env.example`, validated by `lib/env.ts`)

| Variable                                                                                                                                                                                           | Purpose                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`                                                                                                                                                    | Canonical origin, brand                        |
| `DATABASE_URL`, `DIRECT_URL`                                                                                                                                                                       | Pooled + direct (migrations) Postgres URLs     |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                                                                                                                                            | Auth                                           |
| `GOOGLE_CLIENT_ID/SECRET`                                                                                                                                                                          | Optional social login                          |
| `PAYMENT_PROVIDER` (`stripe`\|`razorpay`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments                                       |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_IMAGE_CDN_URL`                                                                                   | Storage                                        |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`                                                                                                                                               | Email                                          |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                                                                               | Rate limiting                                  |
| `CRON_SECRET`                                                                                                                                                                                      | Cron endpoint auth                             |
| `MERCHANT_FEED_TOKEN`                                                                                                                                                                              | Feed access                                    |
| `NEXT_PUBLIC_GA_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`                                                                                                                          | Analytics/verification                         |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                                                                                                                                                  | Monitoring                                     |
| `ENABLE_LLMS_TXT`, `SEED_DEMO_DATA`                                                                                                                                                                | Flags (demo data **never** true in production) |

### 19.3 CI/CD (GitHub Actions)

PR: install → `tsc --noEmit` → ESLint/Prettier → unit/integration → build → Playwright (+axe, SEO) → Lighthouse CI → OSV/audit. `main`: same + `prisma migrate deploy` against staging → smoke tests → manual approval → production deploy → post-deploy smoke + Sentry release. Migrations are forward-only, backward-compatible (expand → migrate → contract).

### 19.4 Hosting options

- **Recommended:** Vercel (Node runtime), Neon/Supabase Postgres (pooled), Cloudflare R2 + CDN, Upstash, Resend, Vercel Cron (reservation release, scheduled publishing).
- **Self-hosted:** `output: 'standalone'` Docker image behind a reverse proxy/CDN; managed Postgres; external cron hitting secured endpoints; shared cache handler if running multiple instances.
- Domain: apex↔www redirect, HTTPS, HSTS preload after verification; DNS with SPF/DKIM/DMARC for email.

### 19.5 Operations runbooks (in `docs/`)

Deploy & rollback · restore from backup · rotate secrets · refund/chargeback handling · stuck `PENDING_PAYMENT` orders · add a new admin · responding to a Next.js security release · SEO incident (indexing drop) checklist.

### 19.6 Launch checklist

All Phase gates passed (§20) · production seed run (admin user, base settings, facets) · real catalogue + photography loaded with alt text · policies reviewed · payment live-mode test order refunded · emails deliverability verified · Search Console/Merchant Center/Bing verified and sitemap submitted · `robots.txt` live (staging `noindex` removed) · backups verified · monitoring alerts live · Lighthouse/CWV and axe green.

---

## 20. Implementation Plan

> Build strictly in order; each phase ends with its **gate**. Nothing ships with dummy buttons — if a control exists, it works.

| Phase                                       | Scope                                                                                                                                                                                                                                  | Deliverables                                 | Gate                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **0. Foundation**                           | Repo, Next 16.4 + TS strict, ESLint/Prettier/Husky, Tailwind v4, shadcn init, env validation, Docker compose, CI skeleton, Prisma init, logger, Sentry                                                                                 | Running app, CI green, `README`              | `npm run dev/build/test` all pass in CI                          |
| **1. Design system & shell**                | Tokens (light/dark), fonts, theme switcher, base components, layout primitives, Header/MegaMenu/Footer/Drawer shells, Breadcrumbs, cookie banner, 404/500, Storybook-style `/dev/ui` page (dev-only)                                   | Component library, both themes               | Contrast test + visual snapshots pass; 7-viewport check          |
| **2. Data & auth**                          | Full Prisma schema + raw migrations, seed, Better Auth (register/verify/login/reset), DAL, roles, rate limiting, audit, action wrapper, email templates                                                                                | Auth flows E2E, role guard tests             | All auth/permission tests pass                                   |
| **3. Admin catalogue**                      | Admin shell, categories, facets, products (variants, diamond specs, images w/ S3 pipeline, SEO tab), inventory + ledger, store settings, shipping zones, banners, articles                                                             | Admin can build the full catalogue           | E2E admin CRUD green; delete/archive semantics verified          |
| **4. Storefront browse**                    | Home, PLP (filters/sort/pagination via nuqs), PDP (gallery, variants, diamond block, enquiry), search + suggest, guides, content pages, wishlist (guest + account)                                                                     | Public catalogue experience                  | Lighthouse budgets on Home/PLP/PDP; axe clean                    |
| **5. Cart & checkout**                      | Cart (guest/account merge), checkout steps, shipping/tax quote, stock reservation transaction, Stripe/Razorpay adapters, webhooks, confirmation + emails, cron release                                                                 | Complete purchase flow in provider test mode | Race-condition + idempotency tests; E2E guest & account checkout |
| **6. Account, orders, tracking, admin ops** | Account area, addresses, order history, guest tracking, admin orders (state machine, tracking, refunds, invoices), customers, dashboard, enquiries inbox, audit log viewer, exports                                                    | Full operations loop                         | Order lifecycle E2E incl. refund + emails                        |
| **7. SEO & AI SEO**                         | Metadata builders, JSON-LD set, sitemaps (segmented, images), robots policy, canonical/redirect rules, OG images, Merchant feed, llms.txt, internal-link modules, guides content templates, SEO test suite, orphan/broken-link crawler | SEO foundation complete                      | SEO suite green; Rich Results Test pass on sample URLs           |
| **8. Hardening**                            | CSP report-only → enforce, perf tuning to budgets, a11y fixes, load test checkout (k6), security scan, error-path review, backup/restore drill, docs/runbooks                                                                          | Production readiness                         | All budgets and security checks pass                             |
| **9. Launch**                               | Production env, domain/DNS/email auth, live-mode payment test, Search Console/Merchant/Bing, monitoring, launch checklist §19.6                                                                                                        | Live site                                    | Checklist signed off                                             |
| **Phase 2 (post-launch)**                   | Verified-purchase reviews + `aggregateRating`, coupons/gift cards, back-in-stock alerts, wishlist sharing, loyalty, additional payment methods, i18n                                                                                   | —                                            | Separate requirements addendum                                   |

---

## 21. Requirements Traceability Matrix

| #   | Your requirement                                                                                                          | Where specified                | Verified by                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| 1   | Customer website (home, listing, detail, categories, search, filters, wishlist, cart, checkout, login/register, tracking) | §5 (CW-01…CW-102), §8, §9      | E2E storefront suites (Phases 4–6)                             |
| 2   | Admin panel (products/categories CRUD, images, inventory, orders & statuses, customers)                                   | §6 (AD-01…AD-74), §7, §8.5–8.6 | E2E admin suites (Phases 3, 6)                                 |
| 3   | Luxury UI/UX, champagne/ivory/beige/gold/bronze/charcoal, no blue/purple                                                  | §11, §12                       | Token tests, visual snapshots, "no blue/purple" colour lint    |
| 4   | Light & dark themes + switcher                                                                                            | §12.5 (UX-10…14)               | Visual snapshots both themes                                   |
| 5   | Fully responsive storefront + admin                                                                                       | §11.8, UX-30, AD-01            | 7-viewport Playwright matrix                                   |
| 6   | Complete SEO                                                                                                              | §13 (SEO-01…30)                | SEO test suite, Rich Results Test, Search Console              |
| 7   | AI SEO / AEO / GEO                                                                                                        | §14 (AI-01…17), §2.2           | Content checklist, manual prompt audit, bot/referral reporting |
| 8   | Performance & security (Next.js best practices, secure auth, RBAC, validation, errors)                                    | §15, §16, §17, §7              | Lighthouse CI, security CI, integration tests                  |
| 9   | Reusable, modular, clean architecture; libraries over bespoke code                                                        | §3, §4, §10, §12.3.1           | Code review checklist, lint rules, module boundaries           |
| —   | No dummy buttons / placeholders                                                                                           | §1.3, §18 Definition of Done   | PR checklist, E2E clicking every control per page              |

---

## 22. Decision Log, Assumptions & Open Questions

### 22.1 Decisions made

| ID   | Decision                                                                 | Reason                                                  |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| D-01 | Better Auth over Auth.js/Clerk                                           | Auth.js team joined Better Auth; self-hosted; owns data |
| D-02 | Prisma + PostgreSQL                                                      | Relational integrity for orders/stock; FTS built in     |
| D-03 | Postgres FTS before external search engine                               | Fewer moving parts at launch; interface allows swap     |
| D-04 | Server Actions for mutations, Route Handlers only where HTTP is required | Type safety, less boilerplate                           |
| D-05 | Money as `Decimal(14,2)`                                                 | High-value items; avoids minor-unit overflow            |
| D-06 | Guest checkout + guest wishlist/cart via signed cookie                   | Conversion; merges on login                             |
| D-07 | Product delete = hard-delete only if never ordered, else archive         | Protects order integrity                                |
| D-08 | `llms.txt` shipped behind flag                                           | Cheap; Google says unnecessary                          |
| D-09 | Reviews, coupons, i18n deferred to Phase 2                               | Avoid half-built features                               |
| D-10 | Facets as data (`FacetType/FacetValue`), not hard-coded columns          | Admin-extensible filters                                |

### 22.2 Assumptions (change via §0.3 if wrong)

- One store, one currency, one primary locale at launch; shipping to the countries configured in zones.
- Products have real photography supplied by the owner; copy is human-reviewed.
- Physical showroom is optional (drives `JewelryStore` markup and appointment info).
- Payment provider is chosen per deployment (one active provider).

### 22.3 Open questions to confirm before Phase 0

1. **Store currency, target countries, and tax regime** (e.g., VAT/GST rate, tax-inclusive pricing) → decides active payment provider and checkout copy.
2. **Brand name, logo, and domain** (replaces `<BRAND>`).
3. **Shipping carriers/insurance rules** for high-value items; any signature-on-delivery requirement.
4. **Return policy terms** (days, conditions, restocking fees) — they feed structured data.
5. **Physical store?** (address/hours for `JewelryStore` markup and appointment CTA.)
6. **AI training-crawler stance** (allow vs block) — default is allow.
7. **Hosting preference** (Vercel vs self-hosted) and managed-Postgres vendor.
8. **Authoring of guides:** who supplies the gemologist/expert content and bios (critical for AI-08/AI-09).

---

## 23. Appendices

### A. URL map

| URL                                                                                     |      Indexable       | Canonical            |   In sitemap    |
| --------------------------------------------------------------------------------------- | :------------------: | -------------------- | :-------------: |
| `/`                                                                                     |          ✔           | self                 |        ✔        |
| `/collections`                                                                          |          ✔           | self                 |        ✔        |
| `/collections/rings`                                                                    |          ✔           | self                 |        ✔        |
| `/collections/rings/engagement-rings?page=2`                                            |          ✔           | self (page 2)        | ✖ (page 1 only) |
| `/collections/rings?metal=gold&sort=price-asc`                                          | ✖ (`noindex,follow`) | `/collections/rings` |        ✖        |
| `/products/solitaire-diamond-engagement-ring-18k-gold`                                  |          ✔           | self                 |   ✔ (+images)   |
| `/products/…?variant=abc`                                                               |          ✖           | product URL          |        ✖        |
| `/guides/diamond-4cs-guide`                                                             |          ✔           | self                 |        ✔        |
| `/search?q=…`, `/cart`, `/checkout`, `/account/**`, `/orders/**`, `/login`, `/admin/**` |          ✖           | —                    |        ✖        |

### B. Product JSON-LD (shape)

```json
{
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  "@id": "https://example.com/products/solitaire-diamond-engagement-ring-18k-gold#product",
  "name": "Solitaire Diamond Engagement Ring in 18K Gold",
  "description": "…",
  "url": "https://example.com/products/solitaire-diamond-engagement-ring-18k-gold",
  "image": ["https://cdn.example.com/…-1x1.webp", "https://cdn.example.com/…-4x5.webp"],
  "brand": { "@type": "Brand", "name": "<BRAND>" },
  "productGroupID": "SOL-001",
  "variesBy": ["https://schema.org/size", "https://schema.org/material"],
  "hasVariant": [
    {
      "@type": "Product",
      "sku": "SOL-001-18Y-6",
      "name": "… / 18K Yellow Gold / Size 6",
      "material": "18K Yellow Gold",
      "offers": {
        "@type": "Offer",
        "url": "https://example.com/products/solitaire-diamond-engagement-ring-18k-gold",
        "priceCurrency": "<CURRENCY>",
        "price": "<PRICE>",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "…": "rate, destination, handlingTime, transitTime"
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "…": "applicableCountry, returnPolicyCategory, merchantReturnDays, returnMethod, returnFees"
        }
      }
    }
  ]
}
```

(Values are generated from the product view-model — never hand-typed.)

### C. `robots.txt` (generated shape)

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /orders

# AI retrieval/search agents — allowed by default
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
# Training crawlers: controlled by Settings → AI crawler policy (default allow)

Sitemap: https://example.com/sitemap.xml
```

### D. Glossary

**AEO** Answer Engine Optimization · **GEO** Generative Engine Optimization · **DAL** Data Access Layer · **PLP/PDP** Product Listing/Detail Page · **LCP/INP/CLS** Core Web Vitals · **4Cs** Cut, Colour, Clarity, Carat · **ADR** Architecture Decision Record.

### E. Research sources consulted (11 Nov 2026)

- Next.js blog & release posts: nextjs.org/blog, nextjs.org/blog/next-16-3
- Auth.js docs (now part of Better Auth): authjs.dev; LogRocket "Best auth library for Next.js 2026"; MakerKit auth comparison
- Google Search Central: "AI features and your website"; "Optimizing your website for generative AI features on Google Search" (15 May 2026) and coverage by Search Engine Journal, PPC Land, Semrush, WordStream
- Google blog: "New opportunities, control and insights for website owners" (generative-AI Search Console controls)
- Product structured data, merchant listings, shipping and return-policy markup and Search Console shipping/returns settings (Google Search Central documentation, summarised by Pemavor and structured-data tooling references)

_End of PROJECT_REQUIREMENTS.md — this document is the baseline for all development._
