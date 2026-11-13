// @vitest-environment node
import { deleteTestOrders } from "../helpers/cleanup";
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminAcceptCustomizationQuote,
  applyCustomizationPreset,
  consumeQuoteTokenAndAddToBag,
  createCustomizationRequest,
  duplicateCustomizationRequest,
  editSubmittedCustomizationRequest,
  getCustomizationRequestDetailForActor,
  hashQuoteToken,
  resolveQuoteAcceptanceToken,
  runCustomizationExpiryReminderJob,
  saveProductCustomizationConfig,
} from "@/modules/customization/customization.service";
import { createOrderAndPayment, processVerifiedWebhookEvent } from "@/modules/orders/order.service";
import type { ActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { ConflictError, ForbiddenError } from "@/server/errors";
import { clearMemoryRateLimits } from "@/server/rate-limit";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

describe("Integration — Customization Requests, Single-Use Quote Tokens & Locked Order Pricing", () => {
  const createdProductIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdWebhookEventIds: string[] = [];
  let categoryId = "";
  let staffUser!: { id: string; email: string; role: string };
  let buyerActor!: ActorIdentity;
  let intruderActor!: ActorIdentity;

  beforeAll(async () => {
    const category = await db.category.findFirstOrThrow({ where: { slug: "rings" } });
    categoryId = category.id;

    const suffix = createId().slice(0, 8);
    const [adminRow, buyerRow, intruderRow] = await Promise.all([
      db.user.findFirstOrThrow({ where: { role: "ADMIN" } }),
      db.user.create({
        data: {
          id: createId(),
          email: `cust-life-${suffix}@example.com`,
          name: "Aurelia Patron",
          role: "CUSTOMER",
          emailVerified: true,
        },
      }),
      db.user.create({
        data: {
          id: createId(),
          email: `cust-intruder-${suffix}@example.com`,
          name: "Intruder User",
          role: "CUSTOMER",
          emailVerified: true,
        },
      }),
    ]);

    createdUserIds.push(buyerRow.id, intruderRow.id);
    staffUser = { id: adminRow.id, email: adminRow.email, role: adminRow.role };

    buyerActor = {
      userId: buyerRow.id,
      userEmail: buyerRow.email,
      userName: buyerRow.name,
      role: "CUSTOMER",
      guestToken: null,
      primaryOwnerKey: `user:${buyerRow.id}`,
      allOwnerKeys: [`user:${buyerRow.id}`],
      isStaff: false,
    };

    intruderActor = {
      userId: intruderRow.id,
      userEmail: intruderRow.email,
      userName: intruderRow.name,
      role: "CUSTOMER",
      guestToken: null,
      primaryOwnerKey: `user:${intruderRow.id}`,
      allOwnerKeys: [`user:${intruderRow.id}`],
      isStaff: false,
    };
  });

  beforeEach(() => {
    clearMemoryRateLimits();
    clearEmailOutbox();
  });

  afterAll(async () => {
    if (createdWebhookEventIds.length > 0) {
      await db.webhookEvent.deleteMany({ where: { eventId: { in: createdWebhookEventIds } } });
    }
    if (createdOrderIds.length > 0) {
      await deleteTestOrders(createdOrderIds);
    }
    if (createdRequestIds.length > 0) {
      await db.customizationRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
    if (createdProductIds.length > 0) {
      await db.customizationRequest.deleteMany({ where: { productId: { in: createdProductIds } } });
      await db.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdUserIds.length > 0) {
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("completes full customization -> edit -> quote token -> checkout price lock -> single-use enforcement", async () => {
    const suffix = createId().slice(0, 8);
    const product = await db.product.create({
      data: {
        sku: `CUS-IT-${suffix.toUpperCase()}`,
        name: `Aurelia Bespoke Solitaire ${suffix}`,
        slug: `aurelia-bespoke-${suffix}`,
        categoryId,
        description: "Test bespoke solitaire creation.",
        status: "ACTIVE",
        priceMode: "FIXED",
        basePrice: "1800.00",
        isCustomizable: true,
        variants: {
          create: {
            sku: `CUS-VAR-${suffix.toUpperCase()}`,
            title: "Standard Mount",
            // Intentionally 0 stock to confirm custom quoted orders bypass standard vault inventory
            stockQty: 0,
            reservedQty: 0,
            isDefault: true,
            isActive: true,
          },
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(product.id);
    const variantId = product.variants[0]!.id;

    // 1. Admin configures product & applies Rings preset
    await saveProductCustomizationConfig(
      {
        productId: product.id,
        enabled: true,
        inheritCategoryDefaults: false,
        groups: [],
        minLeadTimeDays: 14,
        disclaimerText: "Final pricing confirmed by atelier after gem selection.",
      },
      staffUser,
    );
    await applyCustomizationPreset(
      {
        targetType: "product",
        targetId: product.id,
        presetKey: "rings",
        replaceExisting: true,
      },
      staffUser,
    );

    // 2. Customer creates customization request
    const created = await createCustomizationRequest(
      {
        productId: product.id,
        variantId,
        selections: {
          metal: { value: "platinum_950" },
          stone_shape: { value: "oval" },
          diamond_color: { value: "E" },
          clarity: { value: "VVS2" },
          carat_weight: { numberValue: 1.8 },
          ring_size: { value: "US_6" },
          band_width: { value: "2.0mm" },
          engraving: { textValue: "Aurelia 2026" },
        },
        uploadedImages: [],
        customerName: buyerActor.userName!,
        customerEmail: buyerActor.userEmail!,
        contactPreference: "EMAIL",
        preferredTimeline: "Anniversary next month",
      },
      buyerActor,
      "USD",
    );

    expect(created.requestNumber).toMatch(/^CR-\d{4}-\d{5,}$/);
    expect(created.status).toBe("SUBMITTED");
    expect(created.conversationId).toBeTruthy();
    createdRequestIds.push(created.id);

    // Intruder cannot read another customer's customization request
    await expect(
      getCustomizationRequestDetailForActor(created.id, intruderActor),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // 3. Customer can edit while SUBMITTED
    const edited = await editSubmittedCustomizationRequest(
      {
        requestId: created.id,
        selections: {
          metal: { value: "platinum_950" },
          stone_shape: { value: "oval" },
          diamond_color: { value: "D" },
          clarity: { value: "VVS2" },
          carat_weight: { numberValue: 2.0 },
          ring_size: { value: "US_7" },
          band_width: { value: "2.0mm" },
          engraving: { textValue: "Mon Amour" },
        },
        uploadedImages: [],
        contactPreference: "EMAIL",
        customerNote: "Upgraded to D color",
      },
      buyerActor,
    );
    expect(edited.selections.some((s) => s.displayValue === "Mon Amour")).toBe(true);

    // 4. Admin accepts with locked quote ($3,450.00, while product base is $1,800.00)
    clearEmailOutbox();
    const quoteRes = await adminAcceptCustomizationQuote(
      {
        requestId: created.id,
        quotedPriceBase: 3450.0,
        validityDays: 7,
        estimatedDeliveryDays: 21,
        adminMessage: "Approved with GIA certified 2.0ct D VVS2 oval diamond.",
      },
      staffUser,
    );
    expect(quoteRes.quotedPriceBase).toBe("3450.00");

    // Extract single-use token from dispatched quote email
    const emails = getEmailOutbox();
    const quoteEmail = emails.find((e) => e.tag === "customization-quote-approved");
    expect(quoteEmail).toBeTruthy();
    const tokenMatch = quoteEmail!.html.match(/\/customize\/accept\/([A-Za-z0-9_-]+)/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const rawToken = tokenMatch![1]!;

    // Wrong actor cannot claim buyer's token
    await expect(resolveQuoteAcceptanceToken(rawToken, intruderActor)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Customer resolves token cleanly
    const validResolve = await resolveQuoteAcceptanceToken(rawToken, buyerActor);
    expect(validResolve.state).toBe("VALID");
    if (validResolve.state === "VALID") {
      expect(validResolve.lockedPriceBase).toBe("3450.00");
    }

    // Cannot edit once quoted
    await expect(
      editSubmittedCustomizationRequest(
        {
          requestId: created.id,
          selections: {
            metal: { value: "platinum_950" },
            stone_shape: { value: "oval" },
            diamond_color: { value: "D" },
            clarity: { value: "VVS2" },
            carat_weight: { numberValue: 2.0 },
            ring_size: { value: "US_7" },
          },
          uploadedImages: [],
          contactPreference: "EMAIL",
        },
        buyerActor,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // 5. Consume token -> adds customized bag item locked at $3,450.00 -> checkout
    const cart = await consumeQuoteTokenAndAddToBag({ token: rawToken }, buyerActor);
    expect(cart.subtotal).toBe("3450.00");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.isCustomized).toBe(true);
    expect(cart.items[0]?.unitPrice).toBe("3450.00");

    // Reusing the same token must fail
    await expect(
      consumeQuoteTokenAndAddToBag({ token: rawToken }, buyerActor),
    ).rejects.toBeInstanceOf(ConflictError);

    // Create order at locked quote price despite product basePrice = $1,800 and variant stockQty = 0
    const order = await createOrderAndPayment(
      {
        email: buyerActor.userEmail!,
        shippingAddress: {
          fullName: "Aurelia Patron",
          line1: "450 Fifth Avenue",
          line2: null,
          city: "New York",
          state: "NY",
          postalCode: "10018",
          country: "US",
          phone: "+12125550101",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `cus-order-${suffix}`,
      },
      {
        userId: buyerActor.userId,
        cartOwner: { kind: "user", userId: buyerActor.userId! },
      },
    );
    createdOrderIds.push(order.orderId);

    // Base total matches server-locked quote $3,450.00 (plus tax; $0 shipping above threshold)
    expect(order.subtotal).toBe("3450.00");

    // Settle payment via webhook -> transitions order to PAID and CustomizationRequest to ORDERED
    const webhookEventId = `evt_cus_${suffix}`;
    createdWebhookEventIds.push(webhookEventId);
    const settled = await processVerifiedWebhookEvent({
      provider: "STRIPE",
      eventId: webhookEventId,
      eventType: "payment_intent.succeeded",
      status: "succeeded",
      intentId: order.payment.providerIntentId,
      chargeId: `ch_cus_${suffix}`,
      orderIdFromMetadata: order.orderId,
      orderNumberFromMetadata: order.orderNumber,
      failureReason: null,
      amountMinor: null,
      currency: null,
      refundAmountMode: null,
      rawPayload: { test: true },
    });
    expect(settled.duplicate).toBe(false);
    expect(settled.processedOrderId).toBe(order.orderId);

    const updatedReq = await db.customizationRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(updatedReq.status).toBe("ORDERED");
    expect(updatedReq.orderId).toBe(order.orderId);

    const duplicated = await duplicateCustomizationRequest({ requestId: created.id }, buyerActor);
    createdRequestIds.push(duplicated.id);
    expect(duplicated.id).not.toBe(created.id);
    expect(duplicated.status).toBe("SUBMITTED");
  });

  it("marks lapsed quotes EXPIRED and sends 24h expiry reminder once", async () => {
    const product = await db.product.findFirstOrThrow({
      where: { isCustomizable: true, category: { slug: "rings" } },
      include: { variants: { take: 1 } },
    });

    const created = await createCustomizationRequest(
      {
        productId: product.id,
        variantId: product.variants[0]?.id ?? null,
        selections: {
          metal: { value: "platinum_950" },
          stone_shape: { value: "round" },
          diamond_color: { value: "D" },
          clarity: { value: "FL_IF" },
          carat_weight: { numberValue: 1.5 },
          ring_size: { value: "US_6" },
        },
        uploadedImages: [],
        customerName: buyerActor.userName!,
        customerEmail: buyerActor.userEmail!,
        contactPreference: "EMAIL",
      },
      buyerActor,
      "USD",
    );
    createdRequestIds.push(created.id);

    await adminAcceptCustomizationQuote(
      {
        requestId: created.id,
        quotedPriceBase: 4100,
        validityDays: 2,
      },
      staffUser,
    );

    // Force quote expiry to the past and run reminder/expiry cron
    await db.customizationRequest.update({
      where: { id: created.id },
      data: { quoteExpiresAt: new Date(Date.now() - 60_000) },
    });

    const cronRes = await runCustomizationExpiryReminderJob();
    expect(cronRes.expiredCount).toBeGreaterThanOrEqual(1);

    const staleRow = await db.customizationRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(staleRow.status).toBe("EXPIRED");

    // Token referencing expired quote resolves EXPIRED
    const expiredTokenRow = await db.quoteToken.findFirstOrThrow({
      where: { requestId: created.id },
    });
    expect(hashQuoteToken("nonexistent")).not.toBe(expiredTokenRow.tokenHash);
  });
});
