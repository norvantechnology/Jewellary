# Operations Runbooks — Maison Aurelia

Operational procedures for production deployments, database recovery, secret rotation, payment incidents, security patching, and search visibility monitoring.

---

## 1. Deploy & Rollback

### Standard Release (`main`)

1. Confirm GitHub Actions CI passes on the release commit (`.github/workflows/ci.yml`: `typecheck`, `lint`, `format:check`, `next build`, audit).
2. Run forward-only database migrations before switching application instances:
   ```bash
   npx prisma migrate deploy
   ```
   > **Migration Rule:** Schema changes follow expand -> migrate -> contract so previous application containers remain compatible during rolling deploys.
3. Build and deploy the Docker image (`Dockerfile`, standalone Next.js server) or trigger the hosting platform deployment.
4. Run post-deploy smoke checks against `https://<domain>/api/health`, `/`, `/collections`, `/sitemap.xml`, and a test payment webhook check in staging.

### Rollback

1. Re-point traffic / container tag to the previous known-good release digest.
2. **Never run destructive down-migrations in production.** Because migrations are backward-compatible (expand-first), rolling back the app container works cleanly against the expanded schema.
3. Purge CDN/edge cache tags or restart standalone instances if cached page payloads contain stale assets.

---

## 2. Database Backup & Point-in-Time Recovery (PITR) Drill (`SEC-16`)

### Policy

- **Automated backups:** Daily logical/physical PostgreSQL snapshots + continuous WAL archiving enabled for PITR (minimum 14-day retention).
- **Object storage versioning:** Versioning enabled on the R2/S3 media bucket (`public/*` and `tmp/*` assets).
- **Cadence:** Run and log a restore drill **quarterly**.

### Quarterly PITR Restore Drill

1. Create an isolated staging database branch or temporary Postgres instance from the latest backup snapshot (target timestamp `T = now - 2h`).
2. Point a disposable `.env.staging` `DATABASE_URL` / `DIRECT_URL` to the restored instance.
3. Verify schema & data integrity:
   ```bash
   npx prisma migrate status
   ```
4. Check order sequence continuity:
   ```sql
   SELECT last_value FROM order_number_seq;
   SELECT COUNT(*) FROM "Order";
   SELECT COUNT(*) FROM "InventoryTransaction";
   ```
5. Record drill timestamp, recovery time objective (RTO), recovery point objective (RPO), and operator sign-off in internal ops logs, then tear down the disposable clone.

---

## 3. Secret Rotation

Rotate any affected secret immediately upon staff departure, suspected exposure, or scheduled annual rotation:

| Secret                                            | Impact & Steps                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                              | Invalidates active user sessions and signed guest cart/tracking cookies. Update secret in env vault, redeploy, and instruct staff/admins to re-authenticate.             |
| `CRON_SECRET`                                     | Update simultaneously in the app environment and the external scheduler / Vercel Cron header (`Authorization: Bearer <secret>`).                                         |
| `MERCHANT_FEED_TOKEN`                             | Update in app env and Google Merchant Center scheduled fetch URL (`/feeds/google-merchant.xml?token=<token>`).                                                           |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`     | Generate rolling API key / new webhook endpoint secret in Stripe Dashboard -> update env -> deploy -> expire old secret in Stripe after verifying webhooks return `200`. |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Rotate in Razorpay Dashboard -> update env -> redeploy -> verify `/api/webhooks/razorpay`.                                                                               |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`       | Issue new R2/S3 IAM token, deploy updated env, verify `/api/uploads/sign` + `/api/uploads/confirm`, then revoke old token.                                               |
| `RESEND_API_KEY` / `UPSTASH_REDIS_REST_TOKEN`     | Issue replacement token, update env, redeploy, verify transactional email and rate limit health.                                                                         |

---

## 4. Refunds & Chargeback Handling

### Standard Customer Refund (Full or Partial)

1. Sign in as an **`ADMIN`** user (only `ADMIN` holds `orders:refund`; `STAFF` is blocked at UI and server action layer).
2. Open `/admin/orders/[id]`.
3. Choose refund amount (partial or full order total) and whether to return stock to sellable inventory (`restoreStock`), plus an internal staff reason.
4. Submit. The server calls `paymentProvider.refund()`, records the refunded amount on `Order`, transitions to `REFUNDED` on full refund, writes an `InventoryTransaction` (`reason = "RETURN"`) if stock is restored, sends customer notification email, and logs an immutable `AuditLog` entry.

### Payment Gateway Chargeback / Dispute

1. Inspect the Stripe/Razorpay dispute ID in `/admin/orders/[id]` payment records (`Payment.providerRef`).
2. Gather signed delivery evidence from the order page: printable invoice/packing slip (`/admin/orders/[id]/invoice`), shipping carrier & tracking number (`signatureRequired: true`), and `OrderStatusEvent` timestamps.
3. Submit evidence inside the payment provider dashboard before the dispute deadline.
4. Once dispute settles (`charge.dispute.closed` / loss), review inventory status and update internal order notes via `/admin/orders/[id]`.

---

## 5. Recovering Stuck `PENDING_PAYMENT` Orders

Orders stay `PENDING_PAYMENT` while awaiting async webhook settlement, reserving variant stock in `ProductVariant.reservedQty` for 30 minutes (`ORDER_RESERVATION_MINUTES`).

### Automatic Expiry Recovery

- Verify cron jobs are hitting:
  ```bash
  curl -fsS -X POST https://<domain>/api/cron/release-reservations \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Inspect the JSON response (`releasedCount`) and application logs for any errors.

### Manual Verification Before Releasing a Specific Order

1. Cross-check `Payment.providerRef` in `/admin/orders/[id]` against Stripe Dashboard or Razorpay Dashboard to confirm whether payment actually succeeded (e.g., webhook delivery failed).
2. **If payment succeeded in gateway:** Replay the webhook event from the Stripe/Razorpay Dashboard so `/api/webhooks/{provider}` validates signature + amount and transitions the order to `PAID` idempotently.
3. **If payment failed/abandoned and `reservationExpiresAt < now`:** Trigger `/api/cron/release-reservations` with `$CRON_SECRET` to cancel expired reservations and decrement `reservedQty` atomically with `InventoryTransaction` (`reason = "RELEASE"`).

---

## 6. Adding a New Admin User

### Recommended UI Method

1. Have the team member register a normal account via `/register` and **verify their email** (strong password >= 10 chars required).
2. Sign in as an existing `ADMIN`, open `/admin/customers`, search for their email, and open their detail record.
3. Under Role Management, promote role from `CUSTOMER` -> `STAFF` (operations without refunds/settings/role changes) or `ADMIN` (full privileges).
   > **Guardrail:** The backend blocks self-demotion and blocks demoting the final remaining `ADMIN` user. Every role change is recorded in `/admin/audit-log`.

### Break-Glass Database Bootstrap

Only if zero `ADMIN` users exist: set `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, and `ADMIN_SEED_NAME` in a secure terminal with `SEED_DEMO_DATA="false"` and run:

```bash
npm run db:seed
```

---

## 7. Responding to a Next.js / Dependency Security Release (`SEC-13`)

Target SLA: **Patch high/critical advisories (especially Next.js) within 7 days of release.**

1. Update dependencies and regenerate lockfile cleanly:
   ```bash
   npm install next@<patched-version>
   npm audit --audit-level=high
   ```
2. Check bundle/runtime compatibility against Next 16 requirements (`src/proxy.ts`, `next.config.ts`, `cacheComponents`).
3. Run the complete verification gate before merging:
   ```bash
   npm run typecheck && npm run lint && npm run build
   ```
4. Merge, deploy via standard release runbook (§1), and monitor Sentry error rates for 24 hours.

---

## 8. SEO Indexing Drop & AI Crawler WAF Allowlist (`SEO-26`, `SEO-29`, `AI-03`)

### Incident Checklist (Organic / Rich Results Drop)

1. **Check `/robots.txt` & Meta Robots:** Ensure production did NOT accidentally leave staging `noindex` or `Disallow: /` active, and verify Store Settings -> AI Crawler Policy matches business intent.
2. **Check HTTP Status & Redirects:** Run `npm run seo:crawl` against production/staging URLs to verify zero orphan pages, zero unexpected 404/5xx responses, and clean 301 `SlugRedirect` hops.
3. **Check Sitemaps & Canonicals:** Verify `/sitemap.xml` and segmented child sitemaps (`/sitemap/static.xml`, `/sitemap/categories.xml`, `/sitemap/products.xml`, `/sitemap/guides.xml`) return HTTP `200`, only contain indexable `200` canonical URLs, and match visible `<link rel="canonical">`.
4. **Google Search Console & Merchant Center:**
   - Check Coverage / Indexing report for `noindex`, crawl anomalies, or canonical overrides.
   - Check Product Snippets & Merchant Listings rich results reports (`buildProductJsonLd`, `hasMerchantReturnPolicy`, `shippingDetails` match Admin Store Settings).
   - Verify `/feeds/google-merchant.xml?token=$MERCHANT_FEED_TOKEN` fetches cleanly without XML errors.

### CDN / WAF Crawler Allowlist (`SEO-26`, `AI-03`)

Configure Cloudflare / edge WAF rules so legitimate search and chosen AI retrieval bots are never JS-challenged or rate-blocked when serving SSR HTML:

- **Search Engines (verify by reverse DNS / ASN):** `Googlebot`, `Google-InspectionTool`, `Bingbot`, `Applebot`.
- **AI Retrieval & Training Bots (`src/lib/seo/robots-policy.ts`):** `RETRIEVAL_USER_AGENTS` (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `Claude-User`) stay allowed for public citation/indexing, while `AI_TRAINING_USER_AGENTS` (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`) are toggled live from `/admin/settings` via `StoreSetting.allowAiCrawlers`.
- **WAF Action:** Allow direct `GET` / `HEAD` access to indexable storefront routes, `/robots.txt`, `/sitemap*.xml`, `/llms.txt`, and public CDN images (`/uploads/*` / `NEXT_PUBLIC_IMAGE_CDN_URL`) without interactive CAPTCHA/turnstile challenges; keep rate limiting and challenges strictly on `POST` checkout/auth/enquiry endpoints.
