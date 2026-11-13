// @vitest-environment node
import { rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { formatCountryName, COUNTRY_NAMES } from "@/lib/countries";
import { env } from "@/lib/env";
import { formatCarat, formatWeightGrams, maskEmail, maskPhone } from "@/lib/format";
import { buildCatalogPageHref, parseCatalogFilterParams } from "@/lib/search-params";
import {
  INDEXABLE_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  NOINDEX_NOFOLLOW_ROBOTS,
  buildCollectionCanonicalPath,
  buildMetadata,
  formatProductMetaDescription,
  formatProductMetaTitle,
  hasNonCanonicalCollectionQuery,
  toAbsoluteUrl,
} from "@/lib/seo/metadata";
import { cn, isNonEmptyString } from "@/lib/utils";
import { sanitizeAuditPayload } from "@/server/audit";
import { authClient } from "@/server/auth-client";
import { verifyCronAuthorization } from "@/server/cron-auth";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import {
  sendEnquiryNotificationEmails,
  sendEnquiryReplyEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "@/server/email/send";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  OutOfStockError,
  PaymentError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/server/errors";
import { checkRateLimit, clearMemoryRateLimits, enforceRateLimit } from "@/server/rate-limit";
import {
  createSignedImageUpload,
  processAndPersistImageUpload,
  signLocalUploadToken,
  verifyLocalUploadToken,
  writeLocalTempObject,
} from "@/server/storage";

describe("lib utility coverage", () => {
  it("formats country codes cleanly", () => {
    expect(COUNTRY_NAMES.US).toBe("United States");
    expect(formatCountryName(" us ")).toBe("United States (US)");
    expect(formatCountryName("zz")).toBe("ZZ");
  });

  it("merges class names and checks non-empty strings", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(isNonEmptyString("  hello ")).toBe(true);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });

  it("handles nullable format helpers edge cases", () => {
    expect(formatWeightGrams(null)).toBeNull();
    expect(formatWeightGrams("")).toBeNull();
    expect(formatWeightGrams("not-a-number")).toBeNull();
    expect(formatCarat(undefined)).toBeNull();
    expect(formatCarat("abc")).toBeNull();
    expect(maskEmail("broken-email")).toBe("***");
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("123")).toBe("****");
  });

  it("parses catalog filter search params and constructs pagination URLs", () => {
    const parsed = parseCatalogFilterParams({
      q: "  solitaire ",
      metal: ["18k-yellow-gold", " ", "platinum"],
      shape: "oval",
      minPrice: "1000",
      maxPrice: "-5",
      minCarat: "0.75",
      inStock: "1",
      featured: "1",
      new: "1",
      bestseller: "1",
      sort: "price-desc",
      page: "3",
    });

    expect(parsed).toMatchObject({
      q: "solitaire",
      metal: ["18k-yellow-gold", "platinum"],
      shape: ["oval"],
      minPrice: 1000,
      maxPrice: undefined,
      minCarat: 0.75,
      inStock: true,
      featured: true,
      newArrival: true,
      bestseller: true,
      sort: "price-desc",
      page: 3,
    });

    const fallback = parseCatalogFilterParams({ sort: "invalid", page: "0" });
    expect(fallback.sort).toBe("featured");
    expect(fallback.page).toBe(1);

    expect(
      buildCatalogPageHref("/collections/rings", { metal: ["gold", "platinum"], page: "2" }, 1),
    ).toBe("/collections/rings?metal=gold&metal=platinum");
    expect(buildCatalogPageHref("/collections/rings", { sort: "newest" }, 4)).toBe(
      "/collections/rings?sort=newest&page=4",
    );
  });

  it("builds SEO metadata, canonical paths, and product meta helpers", () => {
    expect(hasNonCanonicalCollectionQuery({ page: "2", metal: "gold" })).toBe(true);
    expect(hasNonCanonicalCollectionQuery({ utm_source: "mail" })).toBe(true);
    expect(hasNonCanonicalCollectionQuery({ unexpected: "1" })).toBe(true);
    expect(hasNonCanonicalCollectionQuery({ page: "2" })).toBe(false);

    expect(buildCollectionCanonicalPath("/collections", { page: "3" })).toEqual({
      canonicalPath: "/collections?page=3",
      isFiltered: false,
    });
    expect(buildCollectionCanonicalPath("/collections", { sort: "newest" })).toEqual({
      canonicalPath: "/collections",
      isFiltered: true,
    });

    expect(toAbsoluteUrl("https://cdn.example.com/a.webp")).toBe("https://cdn.example.com/a.webp");
    expect(toAbsoluteUrl("rings")).toMatch(/\/rings$/);

    const articleMeta = buildMetadata({
      title: "Diamond Guide",
      description: "Selecting stones.",
      pathname: "/guides/diamonds",
      type: "article",
      siteDefaultOgImage: "/og-default.jpg",
      publishedTime: "2026-10-01T00:00:00Z",
      modifiedTime: "2026-10-02T00:00:00Z",
      authors: ["Maison Aurelia Atelier"],
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
    expect(articleMeta.openGraph).toMatchObject({ type: "article" });
    expect(articleMeta.robots).toEqual(NOINDEX_FOLLOW_ROBOTS);

    const explicitMeta = buildMetadata({
      absoluteTitle: "Bespoke Salon",
      description: "Custom pieces",
      pathname: "/bespoke",
      canonical: "/custom-salon",
      images: [{ url: "/hero.webp", alt: "Salon" }],
      robots: NOINDEX_NOFOLLOW_ROBOTS,
    });
    expect(explicitMeta.title).toEqual({ absolute: "Bespoke Salon" });

    const segmentMeta = buildMetadata({
      description: "Home",
      pathname: "/",
      useSegmentOgImage: true,
      robots: INDEXABLE_ROBOTS,
    });
    expect(segmentMeta.openGraph?.images).toBeUndefined();

    expect(formatProductMetaTitle({ name: "Solitaire", seoTitle: " Custom SEO " })).toBe(
      "Custom SEO",
    );
    expect(formatProductMetaTitle({ name: "Solitaire", metalType: "18K Gold" })).toBe(
      "Solitaire – 18K Gold | Maison Aurelia",
    );
    expect(formatProductMetaTitle({ name: "Band" })).toBe("Band | Maison Aurelia");

    expect(
      formatProductMetaDescription({ name: "Ring", seoDescription: "Direct SEO summary" }, 30),
    ).toBe("Direct SEO summary");

    const longDesc = formatProductMetaDescription(
      {
        name: "Cathedral Diamond Ring",
        subtitle:
          "Handcrafted 18K yellow gold solitaire ring featuring ethical GIA-certified brilliant diamond with filigree basketwork and heirloom finish",
        caratTotal: "2.15",
        certificationLab: "GIA",
      },
      30,
    );
    expect(longDesc.length).toBeLessThanOrEqual(158);
    expect(longDesc.length).toBeGreaterThanOrEqual(110);
  });
});

describe("server utility coverage", () => {
  const uploadedLocalPaths: string[] = [];

  afterAll(async () => {
    for (const urlPath of uploadedLocalPaths) {
      const clean = urlPath.replace(/^\/+/, "");
      const absBase = path.join(process.cwd(), "public", clean);
      await rm(absBase, { force: true });
      await rm(absBase.replace(/\.webp$/, "-med.webp"), { force: true });
      await rm(absBase.replace(/\.webp$/, "-thumb.webp"), { force: true });
    }
  });

  it("constructs typed AppError hierarchy cleanly", () => {
    const ve = new ValidationError("Bad fields", { email: ["Invalid"] });
    expect(ve.code).toBe("VALIDATION_ERROR");
    expect(ve.statusCode).toBe(400);
    expect(ve.fieldErrors).toEqual({ email: ["Invalid"] });

    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new OutOfStockError().statusCode).toBe(409);
    expect(new PaymentError().statusCode).toBe(402);

    const rl = new RateLimitError("Slow down", 42);
    expect(rl.statusCode).toBe(429);
    expect(rl.retryAfterSeconds).toBe(42);
  });

  it("verifies cron bearer authorization strictly", async () => {
    const missing = verifyCronAuthorization(new Request("http://localhost/api/cron"));
    expect(missing?.status).toBe(401);

    const wrong = verifyCronAuthorization(
      new Request("http://localhost/api/cron", {
        headers: { authorization: "Bearer invalid-secret" },
      }),
    );
    expect(wrong?.status).toBe(401);

    const sameLenWrong = verifyCronAuthorization(
      new Request("http://localhost/api/cron", {
        headers: { authorization: `Bearer ${"x".repeat(env.CRON_SECRET.length)}` },
      }),
    );
    expect(sameLenWrong?.status).toBe(401);

    const ok = verifyCronAuthorization(
      new Request("http://localhost/api/cron", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
    expect(ok).toBeNull();
  });

  it("enforces in-memory rate limits cleanly", async () => {
    clearMemoryRateLimits();
    const id = `unit-${Date.now()}`;
    expect((await checkRateLimit("forgotPassword", id)).success).toBe(true);
    expect((await checkRateLimit("forgotPassword", id)).success).toBe(true);
    expect((await checkRateLimit("forgotPassword", id)).success).toBe(true);

    const blocked = await checkRateLimit("forgotPassword", id);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);

    await expect(enforceRateLimit("forgotPassword", id)).rejects.toBeInstanceOf(RateLimitError);
    clearMemoryRateLimits();
  });

  it("sanitizes audit payloads and redacts sensitive fields", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    const sanitized = sanitizeAuditPayload({
      password: "secret",
      token: "abc",
      nested: [now, { amount: { toFixed: () => "100.00", toString: () => "100.00" } }],
      ok: true,
      skip: undefined,
    }) as Record<string, unknown>;

    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.ok).toBe(true);
    expect(sanitized.skip).toBeNull();
    expect(sanitized.nested).toEqual(["2026-11-11T10:00:00.000Z", { amount: "100.00" }]);
  });

  it("renders React Email templates cleanly to memory outbox in test mode", async () => {
    clearEmailOutbox();
    await sendVerificationEmail({
      to: "claire@example.com",
      name: "Claire",
      verifyUrl: "https://maison.test/verify?token=t1",
    });
    await sendResetPasswordEmail({
      to: "claire@example.com",
      name: "Claire",
      resetUrl: "https://maison.test/reset?token=r1",
    });
    await sendOrderConfirmationEmail({
      to: "claire@example.com",
      recipientName: "Claire",
      orderNumber: "MA-2026-00010",
      lines: [
        {
          title: "Solitaire Ring",
          variantTitle: "18K Gold · Size 6",
          quantity: 1,
          lineTotalFormatted: "$2,500.00",
        },
      ],
      subtotalFormatted: "$2,500.00",
      shippingFormatted: "Complimentary",
      taxFormatted: "$200.00",
      totalFormatted: "$2,700.00",
      trackingUrl: "https://maison.test/orders/MA-2026-00010",
      signatureRequired: true,
    });
    await sendOrderStatusEmail({
      to: "claire@example.com",
      recipientName: "Claire",
      orderNumber: "MA-2026-00010",
      statusLabel: "Shipped",
      message: "Your parcel has departed.",
      carrier: "FedEx Priority",
      trackingNumber: "FX123456",
      orderUrl: "https://maison.test/orders/MA-2026-00010",
    });
    await sendEnquiryNotificationEmails({
      customerName: "Claire",
      customerEmail: "claire@example.com",
      enquiryType: "BESPOKE",
      productName: "Solitaire Ring",
      message: "Looking for platinum setting.",
    });
    await sendEnquiryReplyEmail({
      to: "claire@example.com",
      recipientName: "Claire",
      subject: "Your Bespoke Consultation",
      enquiryType: "BESPOKE",
      replyMessage: "We can craft this in 14 days.",
      productName: "Solitaire Ring",
    });

    const records = getEmailOutbox();
    expect(records.length).toBe(7);
    expect(records.some((r) => r.tag === "order-confirmation")).toBe(true);
    expect(records.some((r) => r.tag === "enquiry-reply")).toBe(true);
    clearEmailOutbox();
  });

  it("validates upload signing, magic bytes, traversal blocking, and WebP conversion", async () => {
    const exp = Date.now() + 60_000;
    const tok = signLocalUploadToken("tmp/store/test", exp);
    expect(verifyLocalUploadToken("tmp/store/test", exp, tok)).toBe(true);
    expect(verifyLocalUploadToken("tmp/store/test", Date.now() - 10, tok)).toBe(false);
    expect(verifyLocalUploadToken("tmp/store/test", exp, "bad")).toBe(false);

    await expect(
      createSignedImageUpload({ folder: "store", mimeType: "image/svg+xml", sizeBytes: 128 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      createSignedImageUpload({ folder: "store", mimeType: "image/png", sizeBytes: 25_000_000 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(writeLocalTempObject("../etc/passwd", Buffer.from("nope"))).rejects.toBeInstanceOf(
      ValidationError,
    );

    const badSigned = await createSignedImageUpload({
      folder: "store",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    await writeLocalTempObject(badSigned.tempKey, Buffer.from("<svg><script/></svg>", "utf8"));
    await expect(
      processAndPersistImageUpload({
        tempKey: badSigned.tempKey,
        folder: "store",
        mode: "local",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const goodPng = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 210, g: 180, b: 140 } },
    })
      .png()
      .toBuffer();

    const goodSigned = await createSignedImageUpload({
      folder: "store",
      mimeType: "image/png",
      sizeBytes: goodPng.byteLength,
    });
    await writeLocalTempObject(goodSigned.tempKey, goodPng);

    const processed = await processAndPersistImageUpload({
      tempKey: goodSigned.tempKey,
      folder: "store",
      mode: "local",
    });
    uploadedLocalPaths.push(processed.url);

    expect(processed.url).toMatch(/^\/uploads\/store\/.*\.webp$/);
    expect(processed.width).toBe(32);
    expect(processed.height).toBe(32);
  });

  it("initializes authClient cleanly", () => {
    expect(authClient).toBeDefined();
  });
});
