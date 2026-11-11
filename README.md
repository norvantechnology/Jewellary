# Premium Jewellery E-Commerce Platform

Full-stack customer storefront, admin panel, and backend built in Next.js 16.4 + TypeScript, PostgreSQL + Prisma, Better Auth, Tailwind CSS v4, and Stripe / Razorpay.

## Local Development Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Start local backing services (PostgreSQL 16, Redis + SRH, MinIO, Mailpit):
   ```bash
   docker compose up -d
   ```
3. Install dependencies and prepare the database:
   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start Next.js development server (Turbopack)
- `npm run build` — Production build (`output: 'standalone'`)
- `npm run typecheck` — TypeScript strict check (`tsc --noEmit`)
- `npm run lint` — ESLint + design-token / no-blue-purple check
- `npm run format:check` — Prettier formatting check
- `npm run test:unit` — Vitest unit tests
- `npm run test:integration` — Vitest integration tests (requires Postgres)
- `npm run test:e2e` — Playwright E2E, accessibility, and SEO checks
- `npm run seo:crawl` — Crawl built app for orphan pages and broken internal links

## Documentation

- `PROJECT_REQUIREMENTS.md` — Authoritative baseline specification
- `docs/PLAN.md` — Phased implementation plan
- `docs/DECISIONS.md` — Recorded implementation decisions
- `docs/PROGRESS.md` — Phase-by-phase build log
