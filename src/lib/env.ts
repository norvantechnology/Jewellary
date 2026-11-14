import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? undefined : val), schema.optional());

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: emptyToUndefined(z.string().min(1)),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: emptyToUndefined(z.string().url()),
    GOOGLE_CLIENT_ID: emptyToUndefined(z.string().min(1)),
    GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().min(1)),

    PAYMENT_PROVIDER: z.enum(["stripe", "razorpay"]).default("stripe"),
    STRIPE_SECRET_KEY: emptyToUndefined(z.string().min(1)),
    STRIPE_WEBHOOK_SECRET: emptyToUndefined(z.string().min(1)),
    RAZORPAY_KEY_ID: emptyToUndefined(z.string().min(1)),
    RAZORPAY_KEY_SECRET: emptyToUndefined(z.string().min(1)),
    RAZORPAY_WEBHOOK_SECRET: emptyToUndefined(z.string().min(1)),
    PAYMENT_TEST_SANDBOX: z.enum(["true", "false"]).default("false"),

    S3_ENDPOINT: emptyToUndefined(z.string().url()),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("jewellery-media"),
    // Private customer uploads; defaults to S3_BUCKET (under private/). Use a private bucket in production.
    S3_PRIVATE_BUCKET: emptyToUndefined(z.string().min(1)),
    S3_ACCESS_KEY_ID: emptyToUndefined(z.string().min(1)),
    S3_SECRET_ACCESS_KEY: emptyToUndefined(z.string().min(1)),

    RESEND_API_KEY: emptyToUndefined(z.string().min(1)),
    EMAIL_FROM: z.string().email().default("concierge@example.com"),
    ADMIN_NOTIFY_EMAIL: z.string().email().default("admin@example.com"),
    SMTP_HOST: emptyToUndefined(z.string().min(1)),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),

    UPSTASH_REDIS_REST_URL: emptyToUndefined(z.string().url()),
    UPSTASH_REDIS_REST_TOKEN: emptyToUndefined(z.string().min(1)),
    REDIS_URL: emptyToUndefined(z.string().min(1)),
    REDIS_HOST: emptyToUndefined(z.string().min(1)),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REALTIME_PORT: z.coerce.number().int().positive().optional(),
    CHAT_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
    CHAT_OFFLINE_EMAIL_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    MALWARE_SCAN_WEBHOOK_URL: emptyToUndefined(z.string().url()),

    CRON_SECRET: z.string().min(8).default("dev_cron_secret_replace_in_prod"),
    MERCHANT_FEED_TOKEN: z.string().min(8).default("dev_merchant_feed_token"),
    ENABLE_LLMS_TXT: z.enum(["true", "false"]).default("true"),
    SEED_DEMO_DATA: z.enum(["true", "false"]).default("false"),

    ADMIN_SEED_EMAIL: z.string().email().default("admin@example.com"),
    ADMIN_SEED_PASSWORD: z.string().min(10).default("AdminChangeMe123!"),
    ADMIN_SEED_NAME: z.string().min(1).default("Atelier Director"),

    SENTRY_DSN: emptyToUndefined(z.string().url()),
    SENTRY_AUTH_TOKEN: emptyToUndefined(z.string().min(1)),
    SENTRY_ORG: emptyToUndefined(z.string().min(1)),
    SENTRY_PROJECT: emptyToUndefined(z.string().min(1)),
    TURNSTILE_SECRET_KEY: emptyToUndefined(z.string().min(1)),
    ABUSE_TIME_TRAP_MS: z.coerce.number().int().min(0).max(60000).default(1000),
    STAGING_MODE: z.enum(["true", "false"]).default("false"),
    STAGING_BASIC_AUTH_USER: emptyToUndefined(z.string().min(1)),
    STAGING_BASIC_AUTH_PASS: emptyToUndefined(z.string().min(1)),
    GOOGLE_SITE_VERIFICATION: emptyToUndefined(z.string().min(1)),
    BING_SITE_VERIFICATION: emptyToUndefined(z.string().min(1)),
    PINTEREST_SITE_VERIFICATION: emptyToUndefined(z.string().min(1)),
    INDEXNOW_KEY: emptyToUndefined(z.string().min(8)),
    CANONICAL_HOST: emptyToUndefined(z.string().min(1)),
    MAINTENANCE_MODE: z.enum(["true", "false"]).default("false"),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().default("https://maisonaurelia.com"),
    NEXT_PUBLIC_SITE_NAME: z.string().min(1).default("Maison Aurelia"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: emptyToUndefined(z.string().min(1)),
    NEXT_PUBLIC_RAZORPAY_KEY_ID: emptyToUndefined(z.string().min(1)),
    NEXT_PUBLIC_IMAGE_CDN_URL: z.string().url().default("http://localhost:9000/jewellery-media"),
    NEXT_PUBLIC_GA_ID: emptyToUndefined(z.string().min(1)),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: emptyToUndefined(z.string().min(1)),
    NEXT_PUBLIC_REALTIME_URL: emptyToUndefined(z.string().url()),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_IMAGE_CDN_URL: process.env.NEXT_PUBLIC_IMAGE_CDN_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" || process.env.npm_lifecycle_event === "lint",
});
