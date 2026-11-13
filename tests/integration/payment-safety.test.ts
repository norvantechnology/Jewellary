// @vitest-environment node
import { deleteTestOrders } from "../helpers/cleanup";
import { createId } from "@paralleldrive/cuid2";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as cronReleaseReservationsGET } from "@/app/api/cron/release-reservations/route";
import { POST as stripeWebhookPOST } from "@/app/api/webhooks/stripe/route";
import { env } from "@/lib/env";
import { toMinorUnits } from "@/lib/money";
import { createOrderAndPayment, retryOrderPayment } from "@/modules/orders/order.service";
import {
  StripePaymentAdapter,
  buildSignedSandboxStripeWebhook,
} from "@/modules/payments/stripe.adapter";
import { db } from "@/server/db";
import { clearEmailOutbox, getEmailOutbox } from "@/server/email/client";
import { PaymentError } from "@/server/errors";

/**
 * Money-safety guarantees for checkout payments:
 * late captures, duplicate captures, amount mismatches, partial refunds,
 * one open payment session per order, and the bag surviving gateway outages.
 */
describe("Payment safety — refunds, amount verification, retries and bag preservation", () => {
  let categoryId = "";
  const productIds: string[] = [];
  const orderIds: string[] = [];
  const cartIds: string[] = [];
  const webhookEventIds: string[] = [];

  const shipping = {
    fullName: "Safety Patron",
    phone: "+1 212 555 0101",
    line1: "1 Vault Street",
    line2: null,
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US",
  };

  beforeAll(async () => {
    const category = await db.category.findFirstOrThrow({ where: { slug: "rings" } });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (orderIds.length) {
      await db.inventoryTransaction.deleteMany({ where: { referenceId: { in: orderIds } } });
      await deleteTestOrders(orderIds);
    }
    if (webhookEventIds.length) {
      await db.webhookEvent.deleteMany({ where: { eventId: { in: webhookEventIds } } });
    }
    if (cartIds.length) await db.cart.deleteMany({ where: { id: { in: cartIds } } });
    if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
    vi.restoreAllMocks();
  });

  async function createProduct(basePrice: string, stockQty = 3) {
    const suffix = createId().slice(0, 8);
    const product = await db.product.create({
      data: {
        sku: `PS-${suffix.toUpperCase()}`,
        name: `Safety Ring ${suffix}`,
        slug: `safety-ring-${suffix}`,
        categoryId,
        description: "Isolated product for payment safety tests.",
        status: "ACTIVE",
        priceMode: "FIXED",
        basePrice,
        variants: {
          create: {
            sku: `PS-V-${suffix.toUpperCase()}`,
            title: "Size 6",
            size: "6",
            metal: "18K Yellow Gold",
            stockQty,
            reservedQty: 0,
            isDefault: true,
            isActive: true,
          },
        },
      },
      include: { variants: true },
    });
    productIds.push(product.id);
    return product.variants[0]!;
  }

  async function createCart(variantId: string) {
    const guestToken = `guest_${createId()}`;
    const cart = await db.cart.create({
      data: {
        guestToken,
        currency: "USD",
        items: { create: { variantId, quantity: 1, unitPriceSnapshot: "1.00" } },
      },
    });
    cartIds.push(cart.id);
    return { guestToken, cartId: cart.id };
  }

  async function placeOrder(basePrice = "1000.00", idempotencyKey = `ps-${createId()}`) {
    const variant = await createProduct(basePrice);
    const { guestToken, cartId } = await createCart(variant.id);
    const created = await createOrderAndPayment(
      {
        email: "safety@example.com",
        shippingAddress: shipping,
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken } },
    );
    orderIds.push(created.orderId);
    return { created, variant, guestToken, cartId, idempotencyKey };
  }

  async function postStripe(rawBody: string, signatureHeader: string) {
    return stripeWebhookPOST(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: rawBody,
        headers: { "stripe-signature": signatureHeader },
      }),
    );
  }

  async function sendCapture(params: {
    intentId: string;
    orderId: string;
    orderNumber: string;
    amountMinor?: number;
    currency?: string;
  }) {
    const signed = buildSignedSandboxStripeWebhook({
      eventType: "payment_intent.succeeded",
      ...params,
    });
    webhookEventIds.push((JSON.parse(signed.rawBody) as { id: string }).id);
    const res = await postStripe(signed.rawBody, signed.signatureHeader);
    expect(res.status).toBe(200);
  }

  function expectedMinor(amount: string, currency: string) {
    return toMinorUnits(amount, currency, true);
  }

  it("auto-refunds a payment captured after the reservation expired, and alerts staff", async () => {
    clearEmailOutbox();
    const { created } = await placeOrder();

    await db.order.update({
      where: { id: created.orderId },
      data: { reservedUntil: new Date(Date.now() - 60_000) },
    });
    const cron = await cronReleaseReservationsGET(
      new Request("http://localhost:3000/api/cron/release-reservations", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
    );
    expect(cron.status).toBe(200);

    // Expired session is voided so it can no longer be charged.
    const voided = await db.paymentTransaction.findUniqueOrThrow({
      where: { providerIntentId: created.payment.providerIntentId },
    });
    expect(voided.status).toBe("CANCELLED");

    // A capture still slips through (e.g. Razorpay or a race) — it must be refunded.
    await sendCapture({
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      amountMinor: expectedMinor(created.chargedAmount, created.chargedCurrency),
      currency: created.chargedCurrency,
    });

    const order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe("CANCELLED");
    const payment = await db.paymentTransaction.findUniqueOrThrow({
      where: { providerIntentId: created.payment.providerIntentId },
    });
    expect(payment.status).toBe("AUTO_REFUNDED");

    const outbox = getEmailOutbox();
    expect(outbox.some((e) => e.tag === "order-status" && e.subject.includes("refunded"))).toBe(
      true,
    );
    expect(outbox.some((e) => e.tag === "payment-alert")).toBe(true);
    expect(outbox.some((e) => e.tag === "order-confirmation")).toBe(false);
  });

  it("refuses to settle when the captured amount does not match the order", async () => {
    clearEmailOutbox();
    const { created, variant } = await placeOrder();

    await sendCapture({
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      amountMinor: 100, // $1.00 instead of the real total
      currency: created.chargedCurrency,
    });

    const order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe("PENDING_PAYMENT");
    const payment = await db.paymentTransaction.findUniqueOrThrow({
      where: { providerIntentId: created.payment.providerIntentId },
    });
    expect(payment.status).toBe("AMOUNT_MISMATCH");
    const v = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v.reservedQty).toBe(1); // still held, not sold
    expect(getEmailOutbox().some((e) => e.tag === "payment-alert")).toBe(true);
  });

  it("settles once and auto-refunds a second capture on an already-paid order", async () => {
    clearEmailOutbox();
    const { created } = await placeOrder();
    const amountMinor = expectedMinor(created.chargedAmount, created.chargedCurrency);

    // Second open session for the same order (e.g. a stale tab).
    const secondIntentId = `pi_sandbox_dup_${createId().slice(0, 10)}`;
    await db.paymentTransaction.create({
      data: {
        orderId: created.orderId,
        provider: "STRIPE",
        providerIntentId: secondIntentId,
        amount: created.chargedAmount,
        currency: created.chargedCurrency,
        status: "REQUIRES_PAYMENT",
      },
    });

    await sendCapture({
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      amountMinor,
      currency: created.chargedCurrency,
    });
    await sendCapture({
      intentId: secondIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      amountMinor,
      currency: created.chargedCurrency,
    });

    const order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe("PAID");
    expect(order.refundedAmount.toString()).toBe("0");
    const second = await db.paymentTransaction.findUniqueOrThrow({
      where: { providerIntentId: secondIntentId },
    });
    expect(second.status).toBe("AUTO_REFUNDED");
    expect(getEmailOutbox().filter((e) => e.tag === "order-confirmation")).toHaveLength(1);
  });

  it("records partial refunds from charge.refunded instead of marking the order fully refunded", async () => {
    const { created } = await placeOrder("1000.00");
    const totalMinor = expectedMinor(created.chargedAmount, created.chargedCurrency);
    await sendCapture({
      intentId: created.payment.providerIntentId,
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      amountMinor: totalMinor,
      currency: created.chargedCurrency,
    });

    const secret = env.STRIPE_WEBHOOK_SECRET ?? env.BETTER_AUTH_SECRET;
    async function sendRefund(amountRefundedMinor: number) {
      const eventId = `evt_refund_${createId()}`;
      webhookEventIds.push(eventId);
      const payload = JSON.stringify({
        id: eventId,
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: `ch_${createId()}`,
            object: "charge",
            payment_intent: created.payment.providerIntentId,
            amount_refunded: amountRefundedMinor,
            currency: created.chargedCurrency.toLowerCase(),
            metadata: { orderId: created.orderId, orderNumber: created.orderNumber },
          },
        },
      });
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
      const res = await postStripe(payload, header);
      expect(res.status).toBe(200);
    }

    await sendRefund(10_000); // $100.00 partial
    let order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe("PAID");
    expect(order.refundedAmount.toFixed(2)).toBe("100.00");

    await sendRefund(totalMinor); // running total reaches the full amount
    order = await db.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refundedAmount.toFixed(2)).toBe(order.total.toFixed(2));
  });

  it("reuses the open payment session on retry instead of creating parallel chargeable intents", async () => {
    const { created } = await placeOrder();
    const first = await retryOrderPayment(
      { orderNumber: created.orderNumber, guestToken: created.guestToken },
      null,
    );
    const second = await retryOrderPayment(
      { orderNumber: created.orderNumber, guestToken: created.guestToken },
      null,
    );
    expect(first.payment.providerIntentId).toBe(created.payment.providerIntentId);
    expect(second.payment.providerIntentId).toBe(created.payment.providerIntentId);
    expect(second.payment.clientSecret).toBeTruthy();
    const open = await db.paymentTransaction.count({
      where: { orderId: created.orderId, status: "REQUIRES_PAYMENT" },
    });
    expect(open).toBe(1);
  });

  it("returns a usable payment session when the same checkout is submitted twice", async () => {
    const { created, guestToken, idempotencyKey } = await placeOrder();
    const replay = await createOrderAndPayment(
      {
        email: "safety@example.com",
        shippingAddress: shipping,
        billingSameAsShipping: true,
        billingAddress: null,
        shippingZoneId: null,
        giftNote: null,
        customerNote: null,
        saveAddressToAccount: false,
        idempotencyKey,
      },
      { userId: null, cartOwner: { kind: "guest", guestToken } },
    );
    expect(replay.orderId).toBe(created.orderId);
    expect(replay.payment.clientSecret).toBeTruthy();
  });

  it("keeps the shopping bag intact when the payment gateway is unreachable", async () => {
    const spy = vi
      .spyOn(StripePaymentAdapter.prototype, "createPaymentIntent")
      .mockRejectedValueOnce(new Error("gateway down"));
    const variant = await createProduct("900.00");
    const { guestToken, cartId } = await createCart(variant.id);

    await expect(
      createOrderAndPayment(
        {
          email: "safety@example.com",
          shippingAddress: shipping,
          billingSameAsShipping: true,
          billingAddress: null,
          shippingZoneId: null,
          giftNote: null,
          customerNote: null,
          saveAddressToAccount: false,
          idempotencyKey: `ps-outage-${createId()}`,
        },
        { userId: null, cartOwner: { kind: "guest", guestToken } },
      ),
    ).rejects.toBeInstanceOf(PaymentError);
    spy.mockRestore();

    const items = await db.cartItem.count({ where: { cartId } });
    expect(items).toBe(1);
    const v = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v.reservedQty).toBe(0);
    const cancelled = await db.order.findMany({
      where: { items: { some: { variantId: variant.id } } },
      select: { id: true, status: true },
    });
    orderIds.push(...cancelled.map((o) => o.id));
    expect(cancelled.every((o) => o.status === "CANCELLED")).toBe(true);
  });
});
