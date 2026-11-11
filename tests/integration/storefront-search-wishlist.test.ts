// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { subscribeNewsletterSchema } from "@/modules/newsletter/newsletter.schemas";
import { resolvePublishedArticleBySlug } from "@/modules/articles/article.service";
import {
  addCartItemForOwner,
  getCartForOwner,
  mergeGuestCartToUser,
} from "@/modules/cart/cart.service";
import {
  getPublicProductBySlug,
  queryCollectionProducts,
  resolveCategoryByPath,
} from "@/modules/catalog/catalog.public";
import { createCustomerEnquiry } from "@/modules/enquiries/enquiry.service";
import { getSearchSuggestions, searchProducts } from "@/modules/search/search.service";
import {
  getWishlistForOwner,
  mergeGuestWishlistToUser,
  toggleWishlistForOwner,
} from "@/modules/wishlist/wishlist.service";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { ConflictError, ValidationError } from "@/server/errors";
import { buildSignedGuestCookieValue, verifySignedGuestCookieValue } from "@/server/guest-token";
import { createPrismaClient } from "@/server/prisma-client";

const db = createPrismaClient();

describe("Phase 4 Integration — Storefront Discovery, FTS/Trigram Search, Wishlist Merge, Enquiries", () => {
  const uniqueSuffix = Date.now().toString(36);
  const createdUserIds: string[] = [];
  const createdWishlistGuestTokens: string[] = [];
  const createdCartGuestTokens: string[] = [];
  const createdEnquiryIds: string[] = [];
  const createdSubscriberEmails: string[] = [];
  const createdProductIds: string[] = [];
  const createdRedirectIds: string[] = [];

  afterAll(async () => {
    for (const id of createdEnquiryIds) {
      await db.enquiry.deleteMany({ where: { id } });
    }
    for (const email of createdSubscriberEmails) {
      await db.newsletterSubscriber.deleteMany({ where: { email } });
    }
    for (const token of createdWishlistGuestTokens) {
      await db.wishlist.deleteMany({ where: { guestToken: token } });
    }
    for (const token of createdCartGuestTokens) {
      await db.cart.deleteMany({ where: { guestToken: token } });
    }
    for (const uid of createdUserIds) {
      await db.wishlist.deleteMany({ where: { userId: uid } });
      await db.cart.deleteMany({ where: { userId: uid } });
      await db.user.deleteMany({ where: { id: uid } });
    }
    for (const pid of createdProductIds) {
      await db.product.deleteMany({ where: { id: pid } });
    }
    for (const rid of createdRedirectIds) {
      await db.slugRedirect.deleteMany({ where: { id: rid } });
    }
    await db.$disconnect();
  });

  it("executes weighted PostgreSQL FTS and pg_trgm typo tolerance without exposing costPrice", async () => {
    // Weighted FTS match
    const exactResult = await searchProducts({ q: "cathedral solitaire" });
    expect(exactResult.total).toBeGreaterThanOrEqual(1);
    const firstCard = exactResult.items[0]!;
    expect("costPrice" in firstCard).toBe(false);

    // Trigram typo tolerance match ('solitare' -> 'Solitaire')
    const typoResult = await searchProducts({ q: "solitare" });
    expect(typoResult.total).toBeGreaterThanOrEqual(1);
    expect(typoResult.items.some((p) => p.name.toLowerCase().includes("solitaire"))).toBe(true);

    // Search suggestions include both categories and matching products
    const suggest = await getSearchSuggestions("gold");
    expect(suggest.products.length + suggest.categories.length).toBeGreaterThan(0);
  });

  it("queries collections recursively across descendant categories and filters by facets", async () => {
    const resolved = await resolveCategoryByPath("rings");
    expect(resolved?.kind).toBe("category");
    if (resolved?.kind !== "category") return;

    const allRings = await queryCollectionProducts({
      categoryIds: resolved.category.descendantIds,
    });
    expect(allRings.total).toBeGreaterThanOrEqual(1);

    const platinumOnly = await queryCollectionProducts({
      categoryIds: resolved.category.descendantIds,
      metal: ["Platinum"],
    });
    expect(platinumOnly.items.every((p) => p.metalType === "Platinum")).toBe(true);
  });

  it("resolves SlugRedirects cleanly on categories, products, and articles", async () => {
    const activeProduct = await db.product.findFirst({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true },
    });
    const activeArticle = await db.article.findFirst({
      where: { isPublished: true },
      select: { slug: true },
    });

    expect(activeProduct).not.toBeNull();
    expect(activeArticle).not.toBeNull();

    const prodRedirect = await db.slugRedirect.create({
      data: {
        entityType: "product",
        oldSlug: `old-prod-${uniqueSuffix}`,
        newSlug: activeProduct!.slug,
      },
    });
    createdRedirectIds.push(prodRedirect.id);

    const catRedirect = await db.slugRedirect.create({
      data: {
        entityType: "category",
        oldSlug: `old-rings-${uniqueSuffix}`,
        newSlug: "rings/engagement-rings",
      },
    });
    createdRedirectIds.push(catRedirect.id);

    const artRedirect = await db.slugRedirect.create({
      data: {
        entityType: "article",
        oldSlug: `old-guide-${uniqueSuffix}`,
        newSlug: activeArticle!.slug,
      },
    });
    createdRedirectIds.push(artRedirect.id);

    const resolvedProd = await getPublicProductBySlug(prodRedirect.oldSlug);
    expect(resolvedProd).toEqual({ kind: "redirect", newSlug: activeProduct!.slug });

    const resolvedCat = await resolveCategoryByPath(catRedirect.oldSlug);
    expect(resolvedCat).toEqual({ kind: "redirect", newPath: "rings/engagement-rings" });

    const resolvedArt = await resolvePublishedArticleBySlug(artRedirect.oldSlug);
    expect(resolvedArt).toEqual({ kind: "redirect", newSlug: activeArticle!.slug });
  });

  it("signs/verifies guest tokens with HMAC-SHA256 and merges guest wishlist & cart on user sign-in", async () => {
    const rawHex = "0123456789abcdef0123456789abcdef";
    const signed = buildSignedGuestCookieValue(rawHex);
    expect(verifySignedGuestCookieValue(signed)).toBe(rawHex);
    expect(verifySignedGuestCookieValue(`${rawHex}.tampered`)).toBeNull();

    const activeVariants = await db.productVariant.findMany({
      where: {
        isActive: true,
        stockQty: { gt: 1 },
        product: { status: "ACTIVE", deletedAt: null, priceMode: "FIXED" },
      },
      take: 2,
      select: { id: true },
    });
    expect(activeVariants.length).toBeGreaterThanOrEqual(2);
    const v1 = activeVariants[0]!.id;
    const v2 = activeVariants[1]!.id;

    const testUser = await db.user.create({
      data: {
        id: `user-merge-${uniqueSuffix}`,
        name: "Wishlist Merge Test User",
        email: `merge-test-${uniqueSuffix}@example.com`,
        role: "CUSTOMER",
      },
    });
    createdUserIds.push(testUser.id);

    const guestWishToken = `g_wish_${uniqueSuffix}`;
    const guestCartToken = `g_cart_${uniqueSuffix}`;
    createdWishlistGuestTokens.push(guestWishToken);
    createdCartGuestTokens.push(guestCartToken);

    // User already saved v1
    await toggleWishlistForOwner({ kind: "user", userId: testUser.id }, v1);
    // Guest saves v1 (duplicate) and v2 (new)
    await toggleWishlistForOwner({ kind: "guest", guestToken: guestWishToken }, v1);
    await toggleWishlistForOwner({ kind: "guest", guestToken: guestWishToken }, v2);

    const mergedWish = await mergeGuestWishlistToUser(guestWishToken, testUser.id);
    expect(mergedWish).toBe(1);

    const userWishState = await getWishlistForOwner({ kind: "user", userId: testUser.id });
    expect(userWishState.count).toBe(2);
    expect(userWishState.variantIds.sort()).toEqual([v1, v2].sort());

    // Guest cart add & stock cap + merge
    await addCartItemForOwner({ kind: "guest", guestToken: guestCartToken }, v1, 1);
    await expect(
      addCartItemForOwner({ kind: "guest", guestToken: guestCartToken }, v1, 999),
    ).rejects.toBeInstanceOf(ConflictError);

    const mergedCartCount = await mergeGuestCartToUser(guestCartToken, testUser.id);
    expect(mergedCartCount).toBe(1);
    const userCart = await getCartForOwner({ kind: "user", userId: testUser.id });
    expect(userCart.itemCount).toBe(1);
    expect(Number(userCart.subtotal)).toBeGreaterThan(0);

    // Price on request items cannot enter shopping bag directly
    const category = await db.category.findFirst({ where: { isActive: true } });
    const porProduct = await db.product.create({
      data: {
        sku: `POR-${uniqueSuffix}`,
        name: `High Jewellery Collier ${uniqueSuffix}`,
        slug: `high-jewellery-collier-${uniqueSuffix}`,
        status: "ACTIVE",
        categoryId: category!.id,
        priceMode: "PRICE_ON_REQUEST",
        basePrice: new Prisma.Decimal(0),
        variants: {
          create: {
            sku: `POR-VAR-${uniqueSuffix}`,
            title: "One of a Kind",
            stockQty: 1,
            isDefault: true,
          },
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(porProduct.id);

    await expect(
      addCartItemForOwner({ kind: "user", userId: testUser.id }, porProduct.variants[0]!.id, 1),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("persists customer enquiries, dispatches acknowledgement & admin emails, and validates newsletter signups", async () => {
    clearEmailOutbox();
    const submitted = await createCustomerEnquiry({
      type: "BESPOKE",
      name: "Claire Test",
      email: `concierge-${uniqueSuffix}@example.com`,
      phone: null,
      message: "Looking for a bespoke radiant cut 2.0ct solitaire in platinum.",
      productId: null,
      website: "",
    });
    createdEnquiryIds.push(submitted.id);

    const outbox = getEmailOutbox();
    expect(outbox.some((m) => m.tag === "enquiry-ack")).toBe(true);
    expect(outbox.some((m) => m.tag === "enquiry-admin")).toBe(true);

    const email = `news-${uniqueSuffix}@example.com`;
    createdSubscriberEmails.push(email);
    const parsed = subscribeNewsletterSchema.parse({ email, source: "footer", website: "" });
    const sub = await db.newsletterSubscriber.create({
      data: { email: parsed.email, source: parsed.source },
    });
    expect(sub.email).toBe(email);
  });
});
