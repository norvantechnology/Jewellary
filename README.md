# Maison Aurelia — Fine Jewellery E-Commerce Platform

Complete production-ready fine jewellery storefront, luxury admin studio, and transactional backend built in a unified **Next.js 16.4 + TypeScript** codebase.

## Technology Stack

- **Framework:** Next.js 16.4 (`App Router`, React 19, React Compiler, `cacheComponents: true`, `output: "standalone"`)
- **Language & Validation:** TypeScript strict mode (`tsc --noEmit`), Zod 4 (`@t3-oss/env-nextjs` boot validation + CSP-safe `z.config({ jitless: true })` client schemas)
- **Database & ORM:** PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`, Decimal arithmetic via `decimal.js`, full-text `tsvector` + `pg_trgm` indexes, CHECK constraints, order-number sequence)
- **Authentication & RBAC:** Better Auth (`CUSTOMER`, `STAFF`, `ADMIN`), signed HTTP-only sessions, email verification, password reset, optional Google OAuth
- **Payments:** Dual provider adapter (`PAYMENT_PROVIDER="stripe" | "razorpay"`) with HMAC webhook verification, idempotency table, atomic stock reservation (`SELECT ... FOR UPDATE`), and signed sandbox test mode
- **Storage & Media:** S3-compatible presigned upload pipeline (Cloudflare R2 / AWS S3 / local MinIO or local fallback via `/api/uploads/*`) + `sharp` EXIF stripping, magic-byte validation (`file-type`), and WebP resizing
- **Design System:** Tailwind CSS v4 semantic tokens (`src/app/globals.css`), Light / Dark / System theme switcher (`next-themes`) with zero flash on load, champagne / ivory / gold / bronze / charcoal palette (enforced lint ban on blue/purple utilities and raw hex)
- **SEO & AI Search:** Multi-segment image sitemaps (`/sitemap.xml`), `robots.ts` with admin-editable AI crawler policy, JSON-LD graphs (`Organization`, `WebSite`, `JewelryStore`, `Product`/`ProductGroup`, `BreadcrumbList`, `CollectionPage`/`ItemList`, `Article`), `/feeds/google-merchant.xml`, `/llms.txt`, and `/opengraph-image`

## Local Development Setup

### 1. Environment Variables

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

Key environment variables (validated at runtime in `src/lib/env.ts` and documented in `.env.example`):

| Group                    | Variables                                                                                                                                       | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| App & Brand              | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, `NODE_ENV`                                                                                     | Canonical origin, brand name, runtime environment                                   |
| Database                 | `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_PORT`                                                                                                   | Pooled / direct PostgreSQL 16 connection strings                                    |
| Auth                     | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                             | Session signing, base URL, optional Google OAuth                                    |
| Payments                 | `PAYMENT_PROVIDER`, `PAYMENT_TEST_SANDBOX`, `STRIPE_*`, `RAZORPAY_*`                                                                            | Active gateway (`stripe` or `razorpay`), keys & webhooks                            |
| Storage                  | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_IMAGE_CDN_URL`                                | MinIO / S3 / R2 object storage and public CDN URL                                   |
| Email                    | `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`, `SMTP_HOST`, `SMTP_PORT`                                                                  | Production Resend API or local Mailpit SMTP (`1025`)                                |
| Rate Limit               | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                            | Sliding-window Upstash Redis / SRH (`8079`) with local memory fallback              |
| Cron & Feeds             | `CRON_SECRET`, `MERCHANT_FEED_TOKEN`, `ENABLE_LLMS_TXT`, `SEED_DEMO_DATA`                                                                       | Bearer secret for cron endpoints, private Merchant Center feed token, feature flags |
| Admin Seed               | `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME`                                                                                    | Initial `ADMIN` account created by `prisma/seed.ts`                                 |
| Telemetry & Verification | `NEXT_PUBLIC_GA_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `SENTRY_*`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Consent-gated analytics, webmaster verification tags, Sentry, optional Turnstile    |

> **Production safeguard:** Never set `SEED_DEMO_DATA="true"` or `PAYMENT_TEST_SANDBOX="true"` in production.

### 2. Start Backing Services

```bash
docker compose up -d
```

Starts PostgreSQL 16 (`5432` default or `${POSTGRES_PORT}`), Redis + Serverless Redis HTTP (`6379` / `8079`), MinIO S3 (`9000` / console `9001` with automatic `jewellery-media` bucket initialization), and Mailpit SMTP/UI (`1025` / `8025`).

### 3. Install Dependencies, Migrate & Seed

```bash
npm install
npm run db:generate
npm run db:migrate
```

Run seed:

- **Production baseline** (`ADMIN` user, default `StoreSetting`, facets, shipping zone):
  ```bash
  npm run db:seed
  ```
- **Local development / QA with demo catalogue, banners & guides:**
  ```bash
  SEED_DEMO_DATA=true npm run db:seed
  ```

### 4. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000`. Sign in to `/admin` using `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`.

## Available Scripts

| Command                                   | Description                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Start Next.js 16 development server with Turbopack                                                             |
| `npm run build`                           | Build production bundle (`next build`, standalone output)                                                      |
| `npm run start`                           | Launch `.next/standalone/server.js` (copies static/public assets automatically via `scripts/start-server.mjs`) |
| `npm run typecheck`                       | Run TypeScript strict compiler (`tsc --noEmit`)                                                                |
| `npm run lint`                            | Run ESLint (includes design-token / no-blue-purple check)                                                      |
| `npm run format` / `npm run format:check` | Format or verify formatting with Prettier                                                                      |
| `npm run test` / `npm run test:unit`      | Run Vitest unit test suite (`tests/unit`)                                                                      |
| `npm run test:integration`                | Run Vitest database/service integration suite (`tests/integration`, requires PostgreSQL)                       |
| `npm run test:all`                        | Run all Vitest unit + integration suites                                                                       |
| `npm run test:coverage`                   | Run all Vitest suites with v8 statement coverage gate (`>= 85%`)                                               |
| `npm run test:e2e`                        | Run Playwright E2E, WCAG 2.2 AA (`axe-core`), security header & SEO suites                                     |
| `npm run seo:crawl`                       | Crawl running production server and fail on broken internal links or sitemap orphans                           |
| `npm run db:generate`                     | Generate Prisma Client                                                                                         |
| `npm run db:migrate`                      | Apply production SQL migrations (`prisma migrate deploy`)                                                      |
| `npm run db:migrate:dev`                  | Create/apply development Prisma migrations                                                                     |
| `npm run db:seed`                         | Run idempotent Prisma seed (`prisma/seed.ts`)                                                                  |

## Cron & Webhook Endpoints

Configure scheduled jobs (Vercel Cron, systemd timer, or GitHub/external scheduler) to send `Authorization: Bearer $CRON_SECRET`:

- `POST /api/cron/release-reservations` (every 5 minutes) — Expires overdue `PENDING_PAYMENT` orders (`> 30 min`) and atomically releases reserved stock + writes `InventoryTransaction` audit entries.
- `POST /api/cron/publish-scheduled` (every 15 minutes) — Publishes scheduled `Article` guides when `publishedAt <= now`.

Webhook endpoints:

- `POST /api/webhooks/stripe` — Verified via `stripe-signature` HMAC + `WebhookEvent` idempotency.
- `POST /api/webhooks/razorpay` — Verified via `x-razorpay-signature` HMAC + `WebhookEvent` idempotency.

## Deployment

### Docker Standalone Image

The included multi-stage [`Dockerfile`](./Dockerfile) builds Next.js standalone output (`output: "standalone"`) alongside `public/`, `.next/static/`, `prisma/`, and `content/`:

```bash
docker build -t maison-aurelia:latest .
docker run --rm -p 3000:3000 --env-file .env.production maison-aurelia:latest
```

Before routing production traffic to a new release, run forward-only migrations (`npx prisma migrate deploy`) and `npm run db:seed` (with `SEED_DEMO_DATA="false"`).

### Managed Hosting (Vercel + Neon/Supabase + R2 + Upstash + Resend)

1. Provision PostgreSQL 16 (pooled `DATABASE_URL` + direct `DIRECT_URL`), Cloudflare R2/S3 bucket (private root, public CDN prefix `public/`), Upstash Redis, Resend domain (SPF/DKIM/DMARC), and Stripe/Razorpay webhooks.
2. Configure environment variables per `.env.example` (`PAYMENT_TEST_SANDBOX="false"`, `SEED_DEMO_DATA="false"`).
3. Deploy via CI/CD (`.github/workflows/ci.yml` runs lint, typecheck, format check, integration/unit tests, Next build, Playwright E2E/axe/SEO checks, and dependency audit).

## Documentation Index

- [`PROJECT_REQUIREMENTS.md`](./PROJECT_REQUIREMENTS.md) — Authoritative platform specification
- [`docs/PLAN.md`](./docs/PLAN.md) — Phased implementation architecture plan
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Recorded architectural decisions (`DEC-01`..`DEC-12`)
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) — Phase 0–9 completion log
- [`docs/RUNBOOKS.md`](./docs/RUNBOOKS.md) — Production operations, disaster recovery, security & SEO runbooks
- [`docs/FINAL_AUDIT.md`](./docs/FINAL_AUDIT.md) — Complete requirement traceability and gate audit report
