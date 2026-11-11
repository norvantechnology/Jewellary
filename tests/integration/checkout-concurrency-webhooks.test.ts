// @vitest-environment node
import crypto from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as cronPublishScheduledGET } from "@/app/api/cron/publish-scheduled/route";
import { GET as cronReleaseReservationsGET } from "@/app/api/cron/release-reservations/route";
import { POST as razorpayWebhookPOST } from "@/app/api/webhooks/razorpay/route";
import { POST as stripeWebhookPOST } from "@/app/api/webhooks/stripe/route";
import { env } from "@/lib/env";
import {
  createOrderAndPayment,
  hashGuestOrderToken,
  verifyGuestOrderToken,
} from "@/modules/orders/order.service";
import { buildSignedSandboxRazorpayWebhook } from "@/modules/payments/razorpay.adapter";
import { buildSignedSandboxStripeWebhook } from "@/modules/payments/stripe.adapter";
import { db } from "@/server/db";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { OutOfStockError } from "@/server/errors";

describe("Phase 5 Integration — Concurrency Stock Reservation, Server Re-pricing, Webhooks & Cron", () => {
  let categoryId = "";
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdArticleIds: string[] = [];
  const createdWebhookEventIds: string[] = [];

  beforeAll(async () => {
    const category = await db.category.findFirstOrThrow({ where: { slug: "rings" } });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await db.inventoryTransaction.deleteMany({
        where: { referenceId: { in: createdOrderIds } },
      });
      await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdWebhookEventIds.length > 0) {
      await db.webhookEvent.deleteMany({
        where: { eventId: { in: createdWebhookEventIds } },
      });
    }
    if (createdCartIds.length > 0) {
      await db.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    }
    if (createdProductIds.length > 0) {
      await db.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdArticleIds.length > 0) {
      await db.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    }
  });

  async function createIsolatedStockProduct(basePrice: string, stockQty: number) {
    const suffix = createId().slice(0, 8);
    const product = await db.product.create({
      data: {
        sku: `IT5-${suffix.toUpperCase()}`,
        name: `Test Solitaire ${suffix}`,
        slug: `test-solitaire-${suffix}`,
        categoryId,
        description: "Isolated test creation for concurrency and webhook checks.",
        status: "ACTIVE",
        priceMode: "FIXED",
        basePrice,
        variants: {
          create: {
            sku: `IT5-V-${suffix.toUpperCase()}`,
            title: "Size 6 / 18K Yellow Gold",
            size: "6",
            metal: "18K Yellow Gold",
            stockQty,
            reservedQty: 0,
            isDefault: true,
            isActive: true,
          },
        },
        images: {
          create: {
            storageKey: `test/${suffix}.webp`,
            url: "/images/seed/celeste-cathedral-solitaire-ring.webp",
            altText: "Test solitaire ring",
            width: 800,
            height: 800,
            isPrimary: true,
            sortOrder: 1,
          },
        },
      },
      include: { variants: true },
    });
    createdProductIds.push(product.id);
    return { product, variant: product.variants[0]! };
  }

  async function createGuestCartWithVariant(
    variantId: string,
    quantity: number,
    fakePrice = "1.00",
  ) {
    const guestToken = `guest_${createId()}`;
    const cart = await db.cart.create({
      data: {
        guestToken,
        currency: "USD",
        items: {
          create: {
            variantId,
            quantity,
            unitPriceSnapshot: fakePrice,
          },
        },
      },
    });
    createdCartIds.push(cart.id);
    return guestToken;
  }

  it("prevents overselling under concurrent checkout race for stock=1 and enforces idempotency", async () => {
    const { variant } = await createIsolatedStockProduct("1200.00", 1);
    const guestA = await createGuestCartWithVariant(variant.id, 1, "5.00");
    const guestB = await createGuestCartWithVariant(variant.id, 1, "5.00");

    const baseShipping = {
      fullName: "Elena Test",
      phone: "+1 212 555 0199",
      line1: "720 Fifth Avenue",
      line2: null,
      city: "New York",
      state: "NY",
      postalCode: "10019",
      country: "US",
    };

    const [resA, resB] = await Promise.allSettled([
      createOrderAndPayment(
        {
          email: "buyer-a@example.com",
          shippingAddress: baseShipping,
          billingSameAsShipping: true,
          billingAddress: null,
          shippingZoneId: null,
          giftNote: null,
          customerNote: null,
          saveAddressToAccount: false,
          idempotencyKey: `idem-a-${createId()}`,
        },
        { userId: null, cartOwner: { kind: "guest", guestToken: guestA } },
      ),
      createOrderAndPayment(
        {
          email: "buyer-b@example.com",
          shippingAddress: baseShipping,
          billingSameAsShipping: true,
          billingAddress: null,
          shippingZoneId: null,
          giftNote: null,
          customerNote: null,
          saveAddressToAccount: false,
          idempotencyKey: `idem-b-${createId()}`,
        },
        { userId: null, cartOwner: { kind: "guest", guestToken: guestB } },
      ),
    ]);

    const fulfilled = [resA, resB].filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createOrderAndPayment>>> =>
        r.status === "fulfilled",
    );
    const rejected = [resA, resB].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(OutOfStockError);

    const winner = fulfilled[0]!.value;
    createdOrderIds.push(winner.orderId);

    // Server ignored tampered $5.00 snapshot and re-priced using live $1200.00 + free US shipping + 8% tax
    expect(winner.subtotal).toBe("1200.00");
    expect(winner.shippingCost).toBe("0.00");
    expect(winner.taxAmount).toBe("96.00");
    expect(winner.total).toBe("1296.00");
    expect(winner.orderNumber).toMatch(/^ORD-\d{4}-\d{5,}$/);

    const updatedVariant = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stockQty).toBe(1);
    expect(updatedVariant.reservedQty).toBe(1);

    // Replaying identical idempotencyKey returns same order without double-reserving
    const replayIdem = `idem-replay-${createId()}`;
    const { variant: variant2 } = await createIsolatedStockProduct("700.00", 2);
    const guestC = await createGuestCartWithVariant(variant2.id, 1);

    const first = await createOrderAndPayment(
      {
        email: "buyer-c@example.com",
        shippingAddress: baseShipping,
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: replayIdem,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken: guestC } },
    );
    createdOrderIds.push(first.orderId);

    const second = await createOrderAndPayment(
      {
        email: "buyer-c@example.com",
        shippingAddress: baseShipping,
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: replayIdem,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken: guestC } },
    );

    expect(second.orderId).toBe(first.orderId);
    const v2 = await db.productVariant.findUniqueOrThrow({ where: { id: variant2.id } });
    expect(v2.reservedQty).toBe(1);
  });

  it("verifies Stripe webhook signature, idempotently settles order & inventory, and emails once", async () => {
    clearEmailOutbox();
    const { variant } = await createIsolatedStockProduct("1500.00", 2);
    const guestToken = await createGuestCartWithVariant(variant.id, 1);

    const created = await createOrderAndPayment(
      {
        email: "patron-stripe@example.com",
        shippingAddress: {
          fullName: "Aria Sterling",
          phone: "+1 310 555 0144",
          line1: "400 Rodeo Drive",
          line2: null,
          city: "Beverly Hills",
          state: "CA",
          postalCode: "90210",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: "For our anniversary",
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `idem-wh-${createId()}`,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken } },
    );
    createdOrderIds.push(created.orderId);

    // Reject forged signature cleanly
    const badRes = await stripeWebhookPOST(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=123,v1=badhash" },
      }),
    );
    expect(badRes.status).toBe(400);

    // Signed payment_intent.succeeded webhook
    const signed = buildSignedSandboxStripeWebhook({
      eventType: "payment_intent.succeeded",
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
    });
    const eventParsed = JSON.parse(signed.rawBody) as { id: string };
    createdWebhookEventIds.push(eventParsed.id);

    const okRes = await stripeWebhookPOST(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: signed.rawBody,
        headers: { "stripe-signature": signed.signatureHeader },
      }),
    );
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as { duplicate: boolean };
    expect(okJson.duplicate).toBe(false);

    const settledOrder = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(settledOrder.status).toBe("PAID");
    expect(settledOrder.reservedUntil).toBeNull();

    const afterVariant = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(afterVariant.stockQty).toBe(1);
    expect(afterVariant.reservedQty).toBe(0);

    const emailsAfterFirst = getEmailOutbox().filter((e) => e.tag === "order-confirmation");
    expect(emailsAfterFirst).toHaveLength(1);
    expect(emailsAfterFirst[0]?.subject).toContain(created.orderNumber);

    // Replay same webhook eventId -> idempotent duplicate, no double stock deduction or extra email
    const dupRes = await stripeWebhookPOST(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: signed.rawBody,
        headers: { "stripe-signature": signed.signatureHeader },
      }),
    );
    expect(dupRes.status).toBe(200);
    const dupJson = (await dupRes.json()) as { duplicate: boolean };
    expect(dupJson.duplicate).toBe(true);

    const variantAfterReplay = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(variantAfterReplay.stockQty).toBe(1);
    expect(getEmailOutbox().filter((e) => e.tag === "order-confirmation")).toHaveLength(1);
  });

  it("verifies Razorpay webhook failure + cron reservation expiry release & scheduled publishing", async () => {
    const { variant } = await createIsolatedStockProduct("800.00", 2);
    const guestToken = await createGuestCartWithVariant(variant.id, 1);

    const created = await createOrderAndPayment(
      {
        email: "patron-rzp@example.com",
        shippingAddress: {
          fullName: "Devika Rao",
          phone: "+1 415 555 0177",
          line1: "250 Market Street",
          line2: null,
          city: "San Francisco",
          state: "CA",
          postalCode: "94105",
          country: "US",
        },
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey: `idem-cron-${createId()}`,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken } },
    );
    createdOrderIds.push(created.orderId);

    // Simulate signed Razorpay failure event on an unrelated synthetic razorpay order
    const signedFail = buildSignedSandboxRazorpayWebhook({
      eventType: "payment.failed",
      razorpayOrderId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      failureMessage: "Insufficient funds",
    });
    const parsedFail = JSON.parse(signedFail.rawBody) as { event_id: string };
    createdWebhookEventIds.push(parsedFail.event_id);

    const failRes = await razorpayWebhookPOST(
      new Request("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        body: signedFail.rawBody,
        headers: { "x-razorpay-signature": signedFail.signatureHeader },
      }),
    );
    expect(failRes.status).toBe(200);

    const afterFail = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(afterFail.status).toBe("PAYMENT_FAILED");

    // Reservation must still hold before expiry
    const variantHeld = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(variantHeld.reservedQty).toBe(1);

    // Expire reservation timestamp in DB and reject unauthorized cron call first
    await db.order.update({
      where: { id: created.orderId },
      data: { reservedUntil: new Date(Date.now() - 60_000) },
    });

    const unauthCron = await cronReleaseReservationsGET(
      new Request("http://localhost:3000/api/cron/release-reservations"),
    );
    expect(unauthCron.status).toBe(401);

    const authCron = await cronReleaseReservationsGET(
      new Request("http://localhost:3000/api/cron/release-reservations", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
    expect(authCron.status).toBe(200);
    const cronData = (await authCron.json()) as { releasedCount: number; orderNumbers: string[] };
    expect(cronData.orderNumbers).toContain(created.orderNumber);

    const cancelledOrder = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(cancelledOrder.status).toBe("CANCELLED");

    const variantReleased = await db.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    expect(variantReleased.reservedQty).toBe(0);
    expect(variantReleased.stockQty).toBe(2);

    // Scheduled article publishing cron
    const dueArticle = await db.article.create({
      data: {
        title: "Scheduled Diamond Provenance",
        slug: `sched-article-${createId().slice(0, 6)}`,
        excerpt: "Scheduled editorial release test.",
        bodyMarkdown: "# Provenance\nScheduled body.",
        authorName: "Maison Editorial",
        isPublished: false,
        publishedAt: new Date(Date.now() - 10_000),
      },
    });
    createdArticleIds.push(dueArticle.id);

    const pubCronRes = await cronPublishScheduledGET(
      new Request("http://localhost:3000/api/cron/publish-scheduled", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
    expect(pubCronRes.status).toBe(200);
    const updatedArticle = await db.article.findUniqueOrThrow({ where: { id: dueArticle.id } });
    expect(updatedArticle.isPublished).toBe(true);
  });

  it("verifies HMAC guest order tokens with constant-time comparison", () => {
    const raw = crypto.randomBytes(24).toString("hex");
    const hashed = hashGuestOrderToken(raw);
    expect(verifyGuestOrderToken(raw, hashed)).toBe(true);
    expect(verifyGuestOrderToken("wrong-token", hashed)).toBe(false);
    expect(verifyGuestOrderToken(null, hashed)).toBe(false);
  });
});
