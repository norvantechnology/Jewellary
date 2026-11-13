// @vitest-environment node
import { deleteTestOrders } from "../helpers/cleanup";
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAbuseFormToken } from "@/server/abuse";
import {
  getEditorialContentPage,
  getEditorialLastModified,
  getEditorialMetadata,
} from "@/lib/content";
import {
  anonymizeCustomerAccount,
  deleteCustomerAddress,
  getAccountOverviewData,
  getAccountProfile,
  getCustomerOrderDetail,
  listCustomerOrders,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerProfile,
  verifyGuestOrderLookup,
} from "@/modules/account/account.service";
import { getAdminDashboardAnalytics } from "@/modules/admin/dashboard.service";
import {
  getPublishedArticleBySlug,
  getPublishedArticles,
  listAllArticles,
  resolvePublishedArticleBySlug,
} from "@/modules/articles/article.service";
import { getActiveBanners, listAllBanners } from "@/modules/banners/banner.service";
import {
  addCartItemForOwner,
  getCartForOwner,
  mergeGuestCartToUser,
  saveCartItemForLater,
  updateCartItemQtyForOwner,
} from "@/modules/cart/cart.service";
import {
  categoryUpsertSchema,
  facetUpsertSchema,
  productUpsertSchema,
} from "@/modules/catalog/catalog.schemas";
import {
  adjustVariantStock,
  deleteCategory,
  deleteFacet,
  getAdminDashboardSummary,
  getAdminProductById,
  listAdminCategories,
  listAdminFacets,
  listAdminInventory,
  listAdminProducts,
  listInventoryTransactions,
  softDeleteProduct,
  upsertCategory,
  upsertFacet,
  upsertProduct,
} from "@/modules/catalog/catalog.service";
import { listAdminCustomers } from "@/modules/customers/customer.service";
import {
  createCustomerEnquiry,
  listAdminEnquiries,
  updateAdminEnquiry,
} from "@/modules/enquiries/enquiry.service";
import {
  getAdminOrderDetail,
  listAdminOrders,
  resendAdminOrderConfirmationEmail,
} from "@/modules/orders/admin-orders.service";
import {
  confirmSandboxOrderPayment,
  createOrderAndPayment,
  releaseExpiredOrderReservations,
  retryOrderPayment,
} from "@/modules/orders/order.service";
import {
  getAllShippingZones,
  getPublicStoreSettings,
  getSiteHeaderConfig,
  normalizeTaxDecimal,
} from "@/modules/settings/settings.service";
import { getSearchSuggestions } from "@/modules/search/search.service";
import {
  getWishlistForOwner,
  mergeGuestWishlistToUser,
  removeWishlistForOwner,
  toggleWishlistForOwner,
} from "@/modules/wishlist/wishlist.service";
import { writeAuditLog } from "@/server/audit";
import type { AuthenticatedContext } from "@/server/dal";
import { db } from "@/server/db";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

describe("Service layer integration coverage", () => {
  const createdUserIds: string[] = [];
  const createdEnquiryIds: string[] = [];
  const createdSlugRedirects: string[] = [];
  const createdExtraProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdFacetIds: string[] = [];
  const createdOrderIds: string[] = [];
  let testUserId = "";
  let testActor: AuthenticatedContext;
  let sampleProductId = "";
  let sampleVariantId = "";
  let existingOrderId = "";

  beforeAll(async () => {
    const email = `cov-${createId().slice(0, 8)}@maison.test`;
    const user = await db.user.create({
      data: {
        id: createId(),
        name: "Coverage Client",
        email,
        role: "CUSTOMER",
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);
    testUserId = user.id;

    const adminRow = await db.user.findFirst({ where: { role: "ADMIN" } });
    testActor = {
      user: {
        id: adminRow?.id ?? user.id,
        name: adminRow?.name ?? "Admin",
        email: adminRow?.email ?? "admin@maison.test",
        role: "ADMIN",
        emailVerified: true,
        twoFactorEnabled: false,
        phone: null,
      },
      sessionId: `sess_${createId().slice(0, 8)}`,
    };

    const category = await db.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Expected at least one seeded category");
    }

    const isolatedProduct = await db.product.create({
      data: {
        sku: `COV-PROD-${createId().slice(0, 6).toUpperCase()}`,
        name: "Coverage Isolated Solitaire Ring",
        slug: `cov-solitaire-${createId().slice(0, 8)}`,
        status: "ACTIVE",
        categoryId: category.id,
        description: "Coverage test diamond ring",
        priceMode: "FIXED",
        basePrice: 1850,
        metalType: "18K Yellow Gold",
        caratTotal: 1.25,
        variants: {
          create: {
            sku: `COV-VAR-${createId().slice(0, 6).toUpperCase()}`,
            title: "18K Gold · Size 6",
            size: "6",
            metal: "18K Yellow Gold",
            stockQty: 5,
            reservedQty: 0,
            lowStockThreshold: 1,
            isDefault: true,
            isActive: true,
          },
        },
      },
      include: { variants: { select: { id: true } } },
    });
    sampleProductId = isolatedProduct.id;
    sampleVariantId = isolatedProduct.variants[0]!.id;

    const existingOrder = await db.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    existingOrderId = existingOrder?.id ?? "";
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({
      where: {
        entityType: { in: ["Order", "Enquiry"] },
        entityId: { in: [...createdEnquiryIds, ...(existingOrderId ? [existingOrderId] : [])] },
        action: { in: ["enquiry.updated", "order.resend_confirmation"] },
      },
    });
    if (createdEnquiryIds.length > 0) {
      await db.enquiry.deleteMany({ where: { id: { in: createdEnquiryIds } } });
    }
    if (createdSlugRedirects.length > 0) {
      await db.slugRedirect.deleteMany({ where: { oldSlug: { in: createdSlugRedirects } } });
    }
    if (createdUserIds.length > 0) {
      await db.cart.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.wishlist.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.address.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await db.cart.deleteMany({ where: { guestToken: { startsWith: "cov_guest_" } } });
    await db.wishlist.deleteMany({ where: { guestToken: { startsWith: "cov_guest_" } } });
    if (createdOrderIds.length > 0) {
      await db.paymentTransaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await db.orderEvent.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await deleteTestOrders(createdOrderIds);
    }
    if (sampleProductId) {
      await db.inventoryTransaction.deleteMany({
        where: { variantId: sampleVariantId },
      });
      await db.productVariant.deleteMany({ where: { productId: sampleProductId } });
      await db.product.deleteMany({ where: { id: sampleProductId } });
    }
    for (const pid of createdExtraProductIds) {
      await db.inventoryTransaction.deleteMany({ where: { referenceId: pid } });
      await db.productImage.deleteMany({ where: { productId: pid } });
      await db.productFacetValue.deleteMany({ where: { productId: pid } });
      await db.productVariant.deleteMany({ where: { productId: pid } });
      await db.product.deleteMany({ where: { id: pid } });
    }
    if (createdCategoryIds.length > 0) {
      await db.categoryFacet.deleteMany({ where: { categoryId: { in: createdCategoryIds } } });
      await db.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    }
    if (createdFacetIds.length > 0) {
      await db.facetOption.deleteMany({ where: { facetId: { in: createdFacetIds } } });
      await db.facet.deleteMany({ where: { id: { in: createdFacetIds } } });
    }
  });

  it("loads editorial markdown content, settings, header config, and banners", async () => {
    const [about, meta, lastMod] = await Promise.all([
      getEditorialContentPage("about"),
      getEditorialMetadata("shipping-returns"),
      getEditorialLastModified("care-guide"),
    ]);
    expect(about.html).toContain("<");
    expect(meta.title).toBeDefined();
    expect(lastMod).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await getEditorialLastModified("non-existent-doc-slug")).toBe(
      "2026-01-01T00:00:00.000Z",
    );

    const [settings, zones, header, allBanners, activeBanners] = await Promise.all([
      getPublicStoreSettings(),
      getAllShippingZones(true),
      getSiteHeaderConfig(),
      listAllBanners(),
      getActiveBanners(),
    ]);
    expect(settings.storeName.length).toBeGreaterThan(0);
    expect(zones.length).toBeGreaterThan(0);
    expect(header.categories.length).toBeGreaterThan(0);
    expect(normalizeTaxDecimal(8.25).toString()).toBe("0.0825");
    expect(Array.isArray(allBanners)).toBe(true);
    expect(Array.isArray(activeBanners)).toBe(true);
  });

  it("loads published articles and resolves slug redirects", async () => {
    const all = await listAllArticles();
    const published = await getPublishedArticles();
    expect(published.length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThanOrEqual(published.length);

    const first = published[0]!;
    const bySlug = await getPublishedArticleBySlug(first.slug);
    expect(bySlug?.id).toBe(first.id);

    const oldSlug = `legacy-guide-${createId().slice(0, 6)}`;
    createdSlugRedirects.push(oldSlug);
    await db.slugRedirect.create({
      data: {
        entityType: "article",
        oldSlug,
        newSlug: first.slug,
      },
    });
    const resolved = await resolvePublishedArticleBySlug(oldSlug);
    expect(resolved).toEqual({ kind: "redirect", newSlug: first.slug });
    expect(await resolvePublishedArticleBySlug("definitely-missing-article")).toBeNull();
  });

  it("computes admin analytics across periods and lists products & inventory", async () => {
    const [today, week, month, quarter, summary, prodList, prodDetail, invList, invTx] =
      await Promise.all([
        getAdminDashboardAnalytics("today"),
        getAdminDashboardAnalytics("7d"),
        getAdminDashboardAnalytics("30d"),
        getAdminDashboardAnalytics("90d"),
        getAdminDashboardSummary(),
        listAdminProducts({ status: "ACTIVE", page: 1, pageSize: 10 }),
        getAdminProductById(sampleProductId),
        listAdminInventory({ page: 1, pageSize: 10 }),
        listInventoryTransactions({ variantId: sampleVariantId, limit: 10 }),
      ]);

    expect(today.series.length).toBe(1);
    expect(week.series.length).toBe(7);
    expect(month.series.length).toBe(30);
    expect(quarter.series.length).toBe(90);
    expect(summary.activeProducts).toBeGreaterThan(0);
    expect(prodList.items.length).toBeGreaterThan(0);
    expect(prodDetail.id).toBe(sampleProductId);
    expect(invList.items.length).toBeGreaterThan(0);
    expect(Array.isArray(invTx)).toBe(true);

    await expect(getAdminProductById("missing-prod")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      adjustVariantStock(
        { variantId: sampleVariantId, reason: "ADJUSTMENT", delta: -99999, note: "bad" },
        testActor.user.id,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("exercises full cart & wishlist guest-to-user workflows", async () => {
    const guestCartOwner = { kind: "guest" as const, guestToken: `cov_guest_${createId()}` };
    const guestWishOwner = { kind: "guest" as const, guestToken: `cov_guest_${createId()}` };
    const userOwner = { kind: "user" as const, userId: testUserId };

    const empty = await getCartForOwner(userOwner);
    expect(empty.itemCount).toBe(0);

    const addedGuest = await addCartItemForOwner(guestCartOwner, sampleVariantId, 1);
    expect(addedGuest.itemCount).toBe(1);

    await expect(addCartItemForOwner(guestCartOwner, sampleVariantId, 50)).rejects.toBeInstanceOf(
      ConflictError,
    );

    const updatedGuest = await updateCartItemQtyForOwner(guestCartOwner, sampleVariantId, 2);
    expect(updatedGuest.itemCount).toBe(2);

    const mergedCartCount = await mergeGuestCartToUser(guestCartOwner.guestToken, testUserId);
    expect(mergedCartCount).toBe(1);

    const savedToWish = await saveCartItemForLater(userOwner, sampleVariantId);
    expect(savedToWish).toContain(sampleVariantId);

    // Re-add then decrement to 0 to cover removal branch
    await addCartItemForOwner(userOwner, sampleVariantId, 1);
    const cleared = await updateCartItemQtyForOwner(userOwner, sampleVariantId, 0);
    expect(cleared.itemCount).toBe(0);

    // Wishlist guest toggle + merge + remove
    const wToggle1 = await toggleWishlistForOwner(guestWishOwner, sampleVariantId);
    expect(wToggle1.wishlisted).toBe(true);
    expect((await getWishlistForOwner(guestWishOwner)).count).toBe(1);
    await mergeGuestWishlistToUser(guestWishOwner.guestToken, testUserId);
    const wAfterRemove = await removeWishlistForOwner(userOwner, sampleVariantId);
    expect(wAfterRemove.count).toBe(0);
  });

  it("covers account management, enquiries admin listing/updating, and order helpers", async () => {
    const profile = await getAccountProfile(testUserId);
    expect(profile.id).toBe(testUserId);
    await expect(getAccountProfile("missing-user-id")).rejects.toBeInstanceOf(NotFoundError);

    const updatedProfile = await updateCustomerProfile(testUserId, {
      name: "Coverage Client Updated",
      phone: "+1 212 555 0142",
    });
    expect(updatedProfile.name).toBe("Coverage Client Updated");

    const addr1 = await saveCustomerAddress(testUserId, {
      label: "Primary",
      fullName: "Coverage Client",
      phone: "+12125550142",
      line1: "10 Madison Ave",
      line2: null,
      city: "New York",
      state: "NY",
      postalCode: "10010",
      country: "US",
      isDefaultShipping: true,
      isDefaultBilling: true,
    });
    const overview = await getAccountOverviewData(testUserId);
    expect(overview.addressCount).toBe(1);
    expect(overview.defaultShippingAddress?.id).toBe(addr1.id);

    await deleteCustomerAddress(testUserId, addr1.id);
    await expect(deleteCustomerAddress(testUserId, addr1.id)).rejects.toBeInstanceOf(NotFoundError);

    const customerOrders = await listCustomerOrders(testUserId, { page: 1, pageSize: 10 });
    expect(customerOrders.total).toBe(0);

    await expect(
      verifyGuestOrderLookup({
        orderNumber: "MA-9999-99999",
        email: "nobody@example.com",
        website: "",
        timingToken: createAbuseFormToken(Date.now() - 5000),
        turnstileToken: "",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Enquiry list + update
    const createdEnquiry = await createCustomerEnquiry(
      {
        type: "PRODUCT",
        name: "Coverage Client",
        email: "cov-client@maison.test",
        phone: "+12125550101",
        message: "Requesting private showroom viewing.",
        productId: sampleProductId,
        website: "",
        timingToken: createAbuseFormToken(Date.now() - 5000),
        turnstileToken: "",
      },
      testUserId,
    );
    createdEnquiryIds.push(createdEnquiry.id);

    const enquiriesPage = await listAdminEnquiries({
      status: "NEW",
      q: "showroom viewing",
      page: 1,
      pageSize: 10,
    });
    expect(enquiriesPage.enquiries.some((e) => e.id === createdEnquiry.id)).toBe(true);

    const updatedEnquiry = await updateAdminEnquiry(
      {
        enquiryId: createdEnquiry.id,
        status: "IN_PROGRESS",
        staffNote: "Confirmed appointment slot.",
      },
      testActor,
    );
    expect(updatedEnquiry.status).toBe("IN_PROGRESS");

    const ordersList = await listAdminOrders({ page: 1, pageSize: 10 });
    expect(Array.isArray(ordersList.orders)).toBe(true);

    if (existingOrderId) {
      clearEmailOutbox();
      const detail = await getAdminOrderDetail(existingOrderId);
      expect(detail.id).toBe(existingOrderId);
      await resendAdminOrderConfirmationEmail(existingOrderId, testActor);
      expect(getEmailOutbox().length).toBe(1);
    }

    const releaseRes = await releaseExpiredOrderReservations(10);
    expect(releaseRes.releasedCount).toBeGreaterThanOrEqual(0);
  });

  it("covers catalog category, facet, product CRUD updates, and delete guards", async () => {
    const uniq = createId().slice(0, 6).toLowerCase();
    const categories = await listAdminCategories();
    const existingFacets = await listAdminFacets();
    expect(categories.length).toBeGreaterThan(0);

    // Create & update facet
    const createdFacet = await upsertFacet(
      facetUpsertSchema.parse({
        code: `cov_finish_${uniq}`,
        name: "Coverage Finish",
        valueType: "TEXT",
        isFilterable: true,
        sortOrder: 99,
        options: [
          { value: "polished", label: "High Polish", swatchHex: "#E5C97B" },
          { value: "brushed", label: "Satin Brushed" },
        ],
      }),
    );
    createdFacetIds.push(createdFacet.id);

    const facetDetail = (await listAdminFacets()).find((f) => f.id === createdFacet.id)!;
    expect(facetDetail.options.length).toBe(2);

    await upsertFacet(
      facetUpsertSchema.parse({
        id: createdFacet.id,
        code: `cov_finish_${uniq}`,
        name: "Coverage Finish Updated",
        valueType: "TEXT",
        options: [
          { id: facetDetail.options[0]!.id, value: "polished", label: "Mirror Polish" },
          { value: "hammered", label: "Hammered" },
        ],
      }),
    );

    // Create & update category
    const cat = await upsertCategory(
      categoryUpsertSchema.parse({
        name: `Coverage Collection ${uniq}`,
        slug: `cov-cat-${uniq}`,
        facetIds: existingFacets[0] ? [existingFacets[0].id] : [],
      }),
    );
    createdCategoryIds.push(cat.id);

    const catUp = await upsertCategory(
      categoryUpsertSchema.parse({
        id: cat.id,
        name: `Coverage Collection Renamed ${uniq}`,
        slug: `cov-cat-renamed-${uniq}`,
        facetIds: [createdFacet.id],
      }),
    );
    createdSlugRedirects.push(`cov-cat-${uniq}`);
    expect(catUp.slug).toBe(`cov-cat-renamed-${uniq}`);

    // Create product (DRAFT) then update -> ACTIVE with image & variants -> softDelete
    const draft = await upsertProduct(
      productUpsertSchema.parse({
        sku: `COV-CRUD-${uniq.toUpperCase()}`,
        name: `Coverage Bracelet ${uniq}`,
        slug: `cov-bracelet-${uniq}`,
        status: "DRAFT",
        categoryId: cat.id,
        leadTimeDays: null,
        basePrice: "1450.00",
        metalType: "18K Gold",
        variants: [
          {
            sku: `COV-BR-1-${uniq.toUpperCase()}`,
            title: "18K Yellow Gold",
            initialStockQty: 3,
            isDefault: true,
          },
        ],
      }),
      testActor.user.id,
    );
    createdExtraProductIds.push(draft.id);

    const draftDetail = await getAdminProductById(draft.id);
    const active = await upsertProduct(
      productUpsertSchema.parse({
        id: draft.id,
        sku: `COV-CRUD-${uniq.toUpperCase()}`,
        name: `Coverage Bracelet Updated ${uniq}`,
        slug: `cov-bracelet-v2-${uniq}`,
        status: "ACTIVE",
        categoryId: cat.id,
        leadTimeDays: 5,
        basePrice: "1550.00",
        variants: [
          {
            id: draftDetail.variants[0]!.id,
            sku: `COV-BR-1-${uniq.toUpperCase()}`,
            title: "18K Yellow Gold",
            initialStockQty: 3,
            isDefault: true,
          },
          {
            sku: `COV-BR-2-${uniq.toUpperCase()}`,
            title: "Platinum",
            initialStockQty: 2,
          },
        ],
        images: [
          {
            storageKey: `cov/bracelet-${uniq}.webp`,
            url: `/uploads/products/cov-${uniq}.webp`,
            altText: "Coverage Bracelet in 18K Yellow Gold",
            isPrimary: true,
          },
        ],
        facetValues: [
          {
            facetId: createdFacet.id,
            valueText: "Mirror Polish",
          },
        ],
      }),
      testActor.user.id,
    );
    createdSlugRedirects.push(`cov-bracelet-${uniq}`);
    expect(active.slug).toBe(`cov-bracelet-v2-${uniq}`);

    // Deleting category blocked while product belongs to it
    await expect(deleteCategory(cat.id)).rejects.toBeInstanceOf(ConflictError);

    const softDeleted = await softDeleteProduct(draft.id);
    expect(softDeleted.id).toBe(draft.id);
    await expect(softDeleteProduct("non-existent-prod")).rejects.toBeInstanceOf(NotFoundError);

    // Clean up products before category delete test
    await db.inventoryTransaction.deleteMany({
      where: { variant: { productId: draft.id } },
    });
    await db.productFacetValue.deleteMany({ where: { productId: draft.id } });
    await db.productVariant.deleteMany({ where: { productId: draft.id } });
    await db.productImage.deleteMany({ where: { productId: draft.id } });
    await db.product.delete({ where: { id: draft.id } });
    createdExtraProductIds.pop();

    const deletedCat = await deleteCategory(cat.id);
    expect(deletedCat.id).toBe(cat.id);
    const deletedFacet = await deleteFacet(createdFacet.id);
    expect(deletedFacet.id).toBe(createdFacet.id);
  });

  it("covers sandbox fail -> retry -> succeed order path, audit writes, billing defaults & customer guards", async () => {
    const guestCartOwner = { kind: "guest" as const, guestToken: `cov_guest_${createId()}` };
    await addCartItemForOwner(guestCartOwner, sampleVariantId, 1);

    const created = await createOrderAndPayment(
      {
        email: "cov-retry@maison.test",
        shippingAddress: {
          fullName: "Retry Client",
          phone: "+1 212 555 0177",
          line1: "45 Park Ave",
          line2: null,
          city: "New York",
          state: "NY",
          postalCode: "10016",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `cov-retry-${createId()}`,
      },
      { userId: null, cartOwner: guestCartOwner },
    );
    createdOrderIds.push(created.orderId);

    const failed = await confirmSandboxOrderPayment(
      {
        orderNumber: created.orderNumber,
        guestToken: created.guestToken,
        outcome: "fail",
      },
      null,
    );
    expect(failed.status).toBe("PAYMENT_FAILED");

    const retried = await retryOrderPayment(
      { orderNumber: created.orderNumber, guestToken: created.guestToken },
      null,
    );
    expect(retried.status).toBe("PENDING_PAYMENT");

    const succeeded = await confirmSandboxOrderPayment(
      {
        orderNumber: created.orderNumber,
        guestToken: created.guestToken,
        outcome: "succeed",
      },
      null,
    );
    expect(succeeded.status).toBe("PAID");

    clearEmailOutbox();
    const adminDetail = await getAdminOrderDetail(created.orderId);
    expect(adminDetail.orderNumber).toBe(created.orderNumber);
    await resendAdminOrderConfirmationEmail(created.orderId, testActor);
    expect(getEmailOutbox().length).toBe(1);

    // Billing default address + anonymize mismatch/admin error guards + customer list + writeAuditLog
    const addr = await saveCustomerAddress(testUserId, {
      label: "Vault Office",
      fullName: "Coverage Client",
      phone: "+12125550142",
      line1: "15 Broadway",
      line2: "Suite 400",
      city: "New York",
      state: "NY",
      postalCode: "10004",
      country: "US",
      isDefaultShipping: false,
      isDefaultBilling: false,
    });
    const billingDefault = await setDefaultCustomerAddress(testUserId, addr.id, "billing");
    expect(billingDefault.isDefaultBilling).toBe(true);

    await expect(
      anonymizeCustomerAccount(testUserId, "wrong-email@maison.test"),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      anonymizeCustomerAccount(testActor.user.id, testActor.user.email),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const customerList = await listAdminCustomers({ q: "cov", page: 1, pageSize: 10 }, testActor);
    expect(customerList.customers.length).toBeGreaterThanOrEqual(1);

    await writeAuditLog({
      actorId: testActor.user.id,
      actorEmail: testActor.user.email,
      actorRole: testActor.user.role,
      action: "coverage.check",
      entityType: "Order",
      entityId: created.orderId,
      after: { verified: true },
    });
    await db.auditLog.deleteMany({
      where: { action: "coverage.check", entityId: created.orderId },
    });

    // Registered user checkout with separate billing address + saveAddressToAccount -> covers customer order list/detail/overview/lookup
    const userCartOwner = { kind: "user" as const, userId: testUserId };
    await addCartItemForOwner(userCartOwner, sampleVariantId, 1);
    const userOrder = await createOrderAndPayment(
      {
        email: (await getAccountProfile(testUserId)).email,
        shippingAddress: {
          fullName: "Coverage Account Client",
          phone: "+1 212 555 0142",
          line1: "22 Madison Ave",
          line2: null,
          city: "New York",
          state: "NY",
          postalCode: "10010",
          country: "US",
        },
        billingSameAsShipping: false,
        billingAddress: {
          fullName: "Coverage Billing Office",
          phone: "+1 212 555 0143",
          line1: "99 Wall St",
          line2: "Floor 8",
          city: "New York",
          state: "NY",
          postalCode: "10005",
          country: "US",
        },
        shippingZoneId: null,
        giftNote: "Velvet ribbon wrapping",
        customerNote: "Deliver after 2pm",
        saveAddressToAccount: true,
        idempotencyKey: `cov-user-${createId()}`,
      },
      { userId: testUserId, cartOwner: userCartOwner },
    );
    createdOrderIds.push(userOrder.orderId);

    const [ordersPage, orderDetail, userOverview, guestVerify, emptySuggest, termSuggest] =
      await Promise.all([
        listCustomerOrders(testUserId, { page: 1, pageSize: 10 }),
        getCustomerOrderDetail(testUserId, userOrder.orderNumber),
        getAccountOverviewData(testUserId),
        verifyGuestOrderLookup({
          orderNumber: userOrder.orderNumber,
          email: (await getAccountProfile(testUserId)).email,
          website: "",
          timingToken: createAbuseFormToken(Date.now() - 5000),
          turnstileToken: "",
        }),
        getSearchSuggestions(""),
        getSearchSuggestions("Ring"),
      ]);
    expect(ordersPage.total).toBe(1);
    expect(orderDetail.orderNumber).toBe(userOrder.orderNumber);
    expect(userOverview.recentOrders.length).toBe(1);
    expect(guestVerify.order.orderNumber).toBe(userOrder.orderNumber);
    expect(emptySuggest.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(termSuggest.products)).toBe(true);

    // Search/inventory filter variations
    const invAll = await listInventoryTransactions({ limit: 5 });
    expect(invAll.length).toBeGreaterThanOrEqual(0);
    const prodSearch = await listAdminProducts({ search: "Coverage", status: "ALL" });
    expect(prodSearch.items.length).toBeGreaterThanOrEqual(1);
  });
});
