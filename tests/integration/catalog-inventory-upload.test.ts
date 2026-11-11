// @vitest-environment node
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import {
  adjustVariantStock,
  deleteCategory,
  softDeleteProduct,
  upsertCategory,
  upsertProduct,
} from "@/modules/catalog/catalog.service";
import { ConflictError, ValidationError } from "@/server/errors";
import { createPrismaClient } from "@/server/prisma-client";
import {
  processAndPersistImageUpload,
  signLocalUploadToken,
  verifyLocalUploadToken,
} from "@/server/storage";

const db = createPrismaClient();

describe("Phase 3 Integration — Catalog, Inventory Ledger & Media Upload Pipeline", () => {
  const uniqueSuffix = Date.now().toString(36);
  const createdCategoryIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdUploadPaths: string[] = [];

  afterAll(async () => {
    for (const pid of createdProductIds) {
      await db.product.deleteMany({ where: { id: pid } });
    }
    for (const cid of [...createdCategoryIds].reverse()) {
      await db.category.deleteMany({ where: { id: cid } });
    }
    await db.slugRedirect.deleteMany({
      where: { oldSlug: { contains: uniqueSuffix } },
    });
    for (const p of createdUploadPaths) {
      await rm(p, { force: true });
    }
    await db.$disconnect();
  });

  it("cascades category paths cleanly, creates SlugRedirects, and blocks deleting non-empty categories", async () => {
    const parent = await upsertCategory({
      name: `Test Metalwork ${uniqueSuffix}`,
      slug: `test-metalwork-${uniqueSuffix}`,
      parentId: null,
      description: null,
      imageUrl: null,
      seoTitle: null,
      seoDescription: null,
      sortOrder: 90,
      isActive: true,
      facetIds: [],
    });
    createdCategoryIds.push(parent.id);
    expect(parent.path).toBe(`test-metalwork-${uniqueSuffix}`);

    const child = await upsertCategory({
      name: `Cuff Bracelets ${uniqueSuffix}`,
      slug: `cuff-${uniqueSuffix}`,
      parentId: parent.id,
      description: null,
      imageUrl: null,
      seoTitle: null,
      seoDescription: null,
      sortOrder: 1,
      isActive: true,
      facetIds: [],
    });
    createdCategoryIds.push(child.id);
    expect(child.path).toBe(`test-metalwork-${uniqueSuffix}/cuff-${uniqueSuffix}`);

    // Rename parent slug and verify descendant path + redirect entries
    const renamedParent = await upsertCategory({
      id: parent.id,
      name: `Renamed Metalwork ${uniqueSuffix}`,
      slug: `metal-${uniqueSuffix}`,
      parentId: null,
      description: null,
      imageUrl: null,
      seoTitle: null,
      seoDescription: null,
      sortOrder: 90,
      isActive: true,
      facetIds: [],
    });
    expect(renamedParent.path).toBe(`metal-${uniqueSuffix}`);

    const childAfter = await db.category.findUnique({ where: { id: child.id } });
    expect(childAfter?.path).toBe(`metal-${uniqueSuffix}/cuff-${uniqueSuffix}`);

    const redirect = await db.slugRedirect.findUnique({
      where: {
        entityType_oldSlug: {
          entityType: "category",
          oldSlug: `test-metalwork-${uniqueSuffix}/cuff-${uniqueSuffix}`,
        },
      },
    });
    expect(redirect?.newSlug).toBe(`metal-${uniqueSuffix}/cuff-${uniqueSuffix}`);

    // Parent has child -> ConflictError on delete
    await expect(deleteCategory(parent.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates products with initial inventory ledger, preserves live stock across edits, and enforces atomic reservation guards", async () => {
    const catId = createdCategoryIds[createdCategoryIds.length - 1]!;
    const prod = await upsertProduct(
      {
        sku: `MA-INT-${uniqueSuffix}`,
        name: `Test Solitaire ${uniqueSuffix}`,
        slug: `solitaire-${uniqueSuffix}`,
        status: "ACTIVE",
        categoryId: catId,
        subtitle: "Test 18K piece",
        description: "Integration verification piece.",
        isFeatured: false,
        isNewArrival: true,
        isBestseller: false,
        hasSizing: true,
        leadTimeDays: 5,
        priceMode: "FIXED",
        basePrice: "2500.00",
        compareAtPrice: null,
        costPrice: "1200.00",
        metalType: "GOLD_18K",
        metalColor: "Yellow Gold",
        metalPurity: "18K",
        metalWeightGrams: "3.80",
        stoneOrigin: "NATURAL",
        stoneShape: "ROUND",
        caratTotal: "1.20",
        caratCenter: "1.20",
        colorGrade: "E",
        clarityGrade: "VS1",
        cutGrade: "Ideal",
        polishGrade: "Excellent",
        symmetryGrade: "Excellent",
        fluorescence: "None",
        certificationLab: "GIA",
        certificateNumber: null,
        certificateUrl: null,
        variants: [
          {
            sku: `MA-INT-${uniqueSuffix}-V1`,
            title: "Size 6",
            size: "US 6",
            metal: "18K Yellow Gold",
            stoneSpec: null,
            priceOverride: null,
            compareAtOverride: null,
            initialStockQty: 4,
            lowStockThreshold: 2,
            isDefault: true,
            isActive: true,
            sortOrder: 0,
            weightGrams: "3.80",
          },
        ],
        images: [
          {
            storageKey: `public/products/test-${uniqueSuffix}.webp`,
            url: `/images/seed/celeste-cathedral-solitaire-ring.webp`,
            thumbUrl: `/images/seed/celeste-cathedral-solitaire-ring-thumb.webp`,
            mediumUrl: `/images/seed/celeste-cathedral-solitaire-ring-med.webp`,
            altText: "18K gold diamond ring side angle",
            width: 1200,
            height: 1200,
            focalX: null,
            focalY: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ],
        facetValues: [],
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
        canonicalOverride: null,
        noindex: false,
        gtin: null,
        mpn: null,
        googleProductCategory: null,
      },
      null,
    );
    createdProductIds.push(prod.id);

    const variant = await db.productVariant.findUniqueOrThrow({
      where: { sku: `MA-INT-${uniqueSuffix}-V1` },
    });
    expect(variant.stockQty).toBe(4);

    // Atomic restock (+2 -> 6)
    const restocked = await adjustVariantStock(
      {
        variantId: variant.id,
        reason: "RESTOCK",
        delta: 2,
        note: "Lab bench receipt",
      },
      null,
    );
    expect(restocked.stockQty).toBe(6);

    // Simulate active checkout reservation of 5 units
    await db.productVariant.update({
      where: { id: variant.id },
      data: { reservedQty: 5 },
    });

    // Attempting to decrement stockQty by 2 (6 -> 4 < reserved 5) fails cleanly with ConflictError
    await expect(
      adjustVariantStock(
        {
          variantId: variant.id,
          reason: "ADJUSTMENT",
          delta: -2,
          note: "Should fail reservation guard",
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // Attempting negative balance fails cleanly with ValidationError
    await expect(
      adjustVariantStock(
        {
          variantId: variant.id,
          reason: "ADJUSTMENT",
          delta: -10,
          note: "Should fail non-negative guard",
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    // Releasing reservation and verifying product slug redirect on update + live stock preservation
    await db.productVariant.update({
      where: { id: variant.id },
      data: { reservedQty: 0 },
    });

    await upsertProduct(
      {
        id: prod.id,
        sku: `MA-INT-${uniqueSuffix}`,
        name: `Test Solitaire Renamed ${uniqueSuffix}`,
        slug: `solitaire-renamed-${uniqueSuffix}`,
        status: "ACTIVE",
        categoryId: catId,
        subtitle: null,
        description: null,
        isFeatured: false,
        isNewArrival: true,
        isBestseller: false,
        hasSizing: true,
        leadTimeDays: 5,
        priceMode: "FIXED",
        basePrice: "2600.00",
        compareAtPrice: null,
        costPrice: null,
        metalType: null,
        metalColor: null,
        metalPurity: null,
        metalWeightGrams: null,
        stoneOrigin: null,
        stoneShape: null,
        caratTotal: null,
        caratCenter: null,
        colorGrade: null,
        clarityGrade: null,
        cutGrade: null,
        polishGrade: null,
        symmetryGrade: null,
        fluorescence: null,
        certificationLab: null,
        certificateNumber: null,
        certificateUrl: null,
        variants: [
          {
            id: variant.id,
            sku: `MA-INT-${uniqueSuffix}-V1`,
            title: "Size 6",
            size: "US 6",
            metal: "18K Yellow Gold",
            stoneSpec: null,
            priceOverride: null,
            compareAtOverride: null,
            initialStockQty: 99, // Should NOT overwrite live stock of 6!
            lowStockThreshold: 2,
            isDefault: true,
            isActive: true,
            sortOrder: 0,
            weightGrams: "3.80",
          },
        ],
        images: [
          {
            storageKey: `public/products/test-${uniqueSuffix}.webp`,
            url: `/images/seed/celeste-cathedral-solitaire-ring.webp`,
            thumbUrl: `/images/seed/celeste-cathedral-solitaire-ring-thumb.webp`,
            mediumUrl: `/images/seed/celeste-cathedral-solitaire-ring-med.webp`,
            altText: "Updated ring alt text",
            width: 1200,
            height: 1200,
            focalX: null,
            focalY: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ],
        facetValues: [],
        seoTitle: null,
        seoDescription: null,
        ogImageUrl: null,
        canonicalOverride: null,
        noindex: false,
        gtin: null,
        mpn: null,
        googleProductCategory: null,
      },
      null,
    );

    const variantAfterEdit = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(variantAfterEdit.stockQty).toBe(6);

    const prodRedirect = await db.slugRedirect.findUnique({
      where: {
        entityType_oldSlug: {
          entityType: "product",
          oldSlug: `solitaire-${uniqueSuffix}`,
        },
      },
    });
    expect(prodRedirect?.newSlug).toBe(`solitaire-renamed-${uniqueSuffix}`);

    await softDeleteProduct(prod.id);
    const softDeleted = await db.product.findUniqueOrThrow({ where: { id: prod.id } });
    expect(softDeleted.status).toBe("ARCHIVED");
    expect(softDeleted.deletedAt).not.toBeNull();
  });

  it("verifies signed local upload tokens, rejects disguised SVGs via magic bytes, and strips EXIF into WebP", async () => {
    const tmpDir = path.join(process.cwd(), ".tmp-uploads", "tmp", "products");
    await mkdir(tmpDir, { recursive: true });

    const badKey = `tmp/products/fake-${uniqueSuffix}.jpg`;
    const exp = Date.now() + 60_000;
    const token = signLocalUploadToken(badKey, exp);
    expect(verifyLocalUploadToken(badKey, exp, token)).toBe(true);
    expect(verifyLocalUploadToken(badKey, Date.now() - 1000, token)).toBe(false);
    expect(verifyLocalUploadToken(badKey, exp, "deadbeef")).toBe(false);

    // Stage an SVG payload pretending to be .jpg
    await writeFile(
      path.join(process.cwd(), ".tmp-uploads", badKey),
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
    );
    await expect(
      processAndPersistImageUpload({ tempKey: badKey, folder: "products", mode: "local" }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Stage valid PNG with EXIF-like comment and process -> WebP with metadata stripped
    const goodKey = `tmp/products/good-${uniqueSuffix}.png`;
    const pngBuffer = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 212, g: 185, b: 132 },
      },
    })
      .withExif({ IFD0: { ImageDescription: "Secret Camera GPS Metadata" } })
      .png()
      .toBuffer();

    await writeFile(path.join(process.cwd(), ".tmp-uploads", goodKey), pngBuffer);
    const saved = await processAndPersistImageUpload({
      tempKey: goodKey,
      folder: "products",
      mode: "local",
    });

    expect(saved.url).toMatch(/^\/uploads\/products\/.+\.webp$/);
    expect(saved.width).toBe(40);
    expect(saved.height).toBe(40);

    const diskFull = path.join(process.cwd(), "public", saved.url.replace(/^\/+/, ""));
    const diskMed = path.join(process.cwd(), "public", saved.mediumUrl.replace(/^\/+/, ""));
    const diskThumb = path.join(process.cwd(), "public", saved.thumbUrl.replace(/^\/+/, ""));
    createdUploadPaths.push(diskFull, diskMed, diskThumb);

    const outMeta = await sharp(await readFile(diskFull)).metadata();
    expect(outMeta.format).toBe("webp");
    expect(outMeta.exif).toBeUndefined();
  });
});
