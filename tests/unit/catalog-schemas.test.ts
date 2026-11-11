import { describe, expect, it } from "vitest";
import { renderSafeMarkdown } from "@/lib/markdown";
import { articleUpsertSchema } from "@/modules/articles/article.schemas";
import { bannerUpsertSchema } from "@/modules/banners/banner.schemas";
import {
  adjustStockSchema,
  categoryUpsertSchema,
  facetUpsertSchema,
  productUpsertSchema,
} from "@/modules/catalog/catalog.schemas";
import { shippingZoneSchema, updateStoreSettingsSchema } from "@/modules/settings/settings.schemas";

describe("Phase 3 — Catalog, Content & Settings Schemas", () => {
  it("validates category upsert strictly and rejects unknown keys", () => {
    const valid = categoryUpsertSchema.safeParse({
      name: "Atelier Cocktail Rings",
      facetIds: ["facet-1", "facet-2"],
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const unknownField = categoryUpsertSchema.safeParse({
      name: "Rings",
      extraAdminBypass: true,
    });
    expect(unknownField.success).toBe(false);
  });

  it("enforces lowercase underscore format on facet codes", () => {
    expect(
      facetUpsertSchema.safeParse({
        code: "setting_style",
        name: "Setting Style",
        valueType: "TEXT",
        options: [{ value: "solitaire", label: "Solitaire" }],
      }).success,
    ).toBe(true);

    expect(
      facetUpsertSchema.safeParse({
        code: "Invalid-Code!",
        name: "Invalid",
      }).success,
    ).toBe(false);
  });

  it("requires image with alt text on ACTIVE products and blocks duplicate variant SKUs", () => {
    const baseProduct = {
      sku: "MA-TEST-100",
      name: "Test Diamond Band",
      categoryId: "cat-1",
      basePrice: "1850.00",
      variants: [
        {
          sku: "MA-TEST-100-5",
          title: "Size 5",
          initialStockQty: 2,
          isDefault: true,
        },
      ],
    };

    const activeWithoutImages = productUpsertSchema.safeParse({
      ...baseProduct,
      status: "ACTIVE",
      images: [],
    });
    expect(activeWithoutImages.success).toBe(false);

    const badAlt = productUpsertSchema.safeParse({
      ...baseProduct,
      status: "ACTIVE",
      images: [
        {
          storageKey: "public/products/a.webp",
          url: "/uploads/products/a.webp",
          altText: "ab",
        },
      ],
    });
    expect(badAlt.success).toBe(false);

    const dupSkus = productUpsertSchema.safeParse({
      ...baseProduct,
      status: "DRAFT",
      variants: [
        { sku: "DUP-1", title: "A" },
        { sku: "dup-1", title: "B" },
      ],
    });
    expect(dupSkus.success).toBe(false);
  });

  it("validates stock adjustments and rejects zero delta", () => {
    expect(
      adjustStockSchema.safeParse({
        variantId: "var-1",
        reason: "RESTOCK",
        delta: 0,
        note: "Zero adjustment check",
      }).success,
    ).toBe(false);

    expect(
      adjustStockSchema.safeParse({
        variantId: "var-1",
        reason: "RESTOCK",
        delta: 3,
        note: "Vault intake",
      }).success,
    ).toBe(true);
  });

  it("validates banners, articles, store settings, and shipping zone day bounds", () => {
    expect(
      bannerUpsertSchema.safeParse({
        title: "Bridal Atelier",
        imageUrl: "/images/seed/hero-bridal-2026.webp",
        altText: "Editorial display of bridal rings on warm travertine",
        position: "HERO",
      }).success,
    ).toBe(true);

    expect(
      articleUpsertSchema.safeParse({
        title: "Diamond Clarity Guide",
        excerpt: "Learn how clarity grading impacts brilliance and proportions.",
        bodyMarkdown: "## Overview\nUnderstanding clarity grades from FL to SI.",
        authorName: "Maison Gemologist",
      }).success,
    ).toBe(true);

    expect(
      updateStoreSettingsSchema.safeParse({
        storeName: "Maison Aurelia",
        contactEmail: "concierge@example.com",
        currency: "USD",
        defaultCountry: "US",
        supportedCountries: ["US", "CA"],
        taxRatePercent: 8,
        taxLabel: "Estimated Tax",
        taxInclusive: false,
        signatureThreshold: "500.00",
        returnWindowDays: 30,
        announcementBarEnabled: true,
        allowAiCrawlers: true,
      }).success,
    ).toBe(true);

    const invalidDays = shippingZoneSchema.safeParse({
      name: "Express",
      countries: ["US"],
      flatRate: "25.00",
      estimatedDaysMin: 6,
      estimatedDaysMax: 2,
    });
    expect(invalidDays.success).toBe(false);
  });

  it("sanitizes dangerous scripts inside Markdown guides", async () => {
    const html = await renderSafeMarkdown(
      `## Craftsmanship\n\n<script>alert('xss')</script>\n\n**Gold** band with <img src=x onerror="alert(1)" /> safety.`,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("<strong>Gold</strong>");
  });
});
