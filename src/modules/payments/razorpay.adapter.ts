import "server-only";
import crypto from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import Razorpay from "razorpay";
import { env } from "@/lib/env";
import { toMinorUnits } from "@/lib/money";
import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  CreateRefundInput,
  CreateRefundResult,
  PaymentProviderAdapter,
  VerifiedWebhookEvent,
} from "@/modules/payments/payment.types";
import { PaymentError, ValidationError } from "@/server/errors";

export class RazorpayPaymentAdapter implements PaymentProviderAdapter {
  readonly provider = "RAZORPAY" as const;
  private client: Razorpay | null = null;
  private clientCredKey: string | null = null;

  get isSandbox(): boolean {
    return env.PAYMENT_TEST_SANDBOX === "true" || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET;
  }

  private getClient(): Razorpay {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new PaymentError("Razorpay API credentials are not configured.");
    }
    const credKey = `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`;
    if (!this.client || this.clientCredKey !== credKey) {
      this.clientCredKey = credKey;
      this.client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.client;
  }

  private getWebhookSecret(): string {
    if (env.RAZORPAY_WEBHOOK_SECRET) {
      return env.RAZORPAY_WEBHOOK_SECRET;
    }
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      return env.BETTER_AUTH_SECRET;
    }
    throw new PaymentError("Razorpay webhook secret is not configured.");
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      const orderRef = `order_sandbox_${input.orderId.slice(-10)}_${createId().slice(0, 6)}`;
      return {
        provider: "RAZORPAY",
        providerIntentId: orderRef,
        clientSecret: null,
        razorpayOrderId: orderRef,
        keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
        mode: "sandbox",
        rawResponse: {
          sandbox: true,
          amountMinor: toMinorUnits(input.amountDecimal, input.currency),
          currency: input.currency.toUpperCase(),
        },
      };
    }

    const rzp = this.getClient();
    const order = await rzp.orders.create({
      amount: toMinorUnits(input.amountDecimal, input.currency),
      currency: input.currency.toUpperCase(),
      receipt: input.orderNumber,
      notes: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return {
      provider: "RAZORPAY",
      providerIntentId: order.id,
      clientSecret: null,
      razorpayOrderId: order.id,
      keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID ?? null,
      mode: "live",
      rawResponse: { id: order.id, status: order.status },
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signatureHeader) {
      throw new ValidationError("Missing Razorpay signature header.");
    }

    const secret = this.getWebhookSecret();
    const valid = Razorpay.validateWebhookSignature(rawBody, signatureHeader, secret);
    if (!valid) {
      throw new ValidationError("Invalid Razorpay webhook signature.");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Malformed JSON in Razorpay webhook payload.");
    }

    const eventType = typeof parsed.event === "string" ? parsed.event : "unknown";
    const payloadObj = (parsed.payload ?? {}) as Record<string, unknown>;
    const paymentEntity = ((payloadObj.payment as Record<string, unknown> | undefined)?.entity ??
      {}) as Record<string, unknown>;
    const notes = (paymentEntity.notes ?? {}) as Record<string, unknown>;

    const orderId = typeof paymentEntity.order_id === "string" ? paymentEntity.order_id : null;
    const paymentId = typeof paymentEntity.id === "string" ? paymentEntity.id : null;
    const eventId =
      typeof parsed.event_id === "string"
        ? parsed.event_id
        : crypto.createHash("sha256").update(rawBody).digest("hex");

    const refundEntity = ((payloadObj.refund as Record<string, unknown> | undefined)?.entity ??
      {}) as Record<string, unknown>;

    let status: VerifiedWebhookEvent["status"] = "ignored";
    let amountMinor: number | null = null;
    let refundAmountMode: VerifiedWebhookEvent["refundAmountMode"] = null;
    let currency: string | null =
      typeof paymentEntity.currency === "string" ? paymentEntity.currency.toUpperCase() : null;

    if (eventType === "payment.captured" || eventType === "order.paid") {
      status = "succeeded";
      amountMinor = typeof paymentEntity.amount === "number" ? paymentEntity.amount : null;
    } else if (eventType === "payment.failed") {
      status = "failed";
    } else if (eventType === "refund.processed") {
      status = "refunded";
      // Each refund.processed event carries only that refund's amount.
      amountMinor = typeof refundEntity.amount === "number" ? refundEntity.amount : null;
      if (typeof refundEntity.currency === "string") currency = refundEntity.currency.toUpperCase();
      refundAmountMode = "incremental";
    }

    return {
      provider: "RAZORPAY",
      eventId,
      eventType,
      intentId: orderId,
      chargeId: paymentId,
      orderIdFromMetadata: typeof notes.orderId === "string" ? notes.orderId : null,
      orderNumberFromMetadata: typeof notes.orderNumber === "string" ? notes.orderNumber : null,
      status,
      failureReason:
        typeof paymentEntity.error_description === "string"
          ? paymentEntity.error_description
          : null,
      amountMinor,
      currency,
      refundAmountMode,
      rawPayload: parsed,
    };
  }

  /**
   * Confirms a payment right after the Razorpay Checkout popup succeeds (Razorpay's recommended
   * flow), so the order is marked paid immediately; the webhook remains a backup and is
   * de-duplicated. Steps: verify the checkout signature with the key secret, then fetch the
   * payment from Razorpay (never trust the browser) and capture it if it is only authorized.
   */
  async verifyCheckoutPayment(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    expectedAmountMinor: number;
    expectedCurrency: string;
    orderId: string;
    orderNumber: string;
  }): Promise<VerifiedWebhookEvent> {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new PaymentError("Razorpay API credentials are not configured.");
    }
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest("hex");
    const given = Buffer.from(input.razorpaySignature, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
      throw new ValidationError("Invalid Razorpay payment signature.");
    }

    const rzp = this.getClient();
    let payment = await rzp.payments.fetch(input.razorpayPaymentId);
    if (payment.order_id !== input.razorpayOrderId) {
      throw new ValidationError("Razorpay payment does not belong to this order.");
    }
    if (payment.status === "authorized") {
      // Auto-capture is off in the Razorpay account: capture the exact order amount now.
      payment = await rzp.payments.capture(
        input.razorpayPaymentId,
        input.expectedAmountMinor,
        input.expectedCurrency.toUpperCase(),
      );
    }

    const status: VerifiedWebhookEvent["status"] =
      payment.status === "captured"
        ? "succeeded"
        : payment.status === "failed"
          ? "failed"
          : "ignored";

    return {
      provider: "RAZORPAY",
      // Stable id: repeated confirmations of the same payment are processed once.
      eventId: `checkout_${input.razorpayPaymentId}`,
      eventType: `checkout.payment.${payment.status}`,
      intentId: input.razorpayOrderId,
      chargeId: input.razorpayPaymentId,
      orderIdFromMetadata: input.orderId,
      orderNumberFromMetadata: input.orderNumber,
      status,
      failureReason: payment.error_description ?? null,
      amountMinor: typeof payment.amount === "number" ? payment.amount : Number(payment.amount),
      currency: payment.currency ? String(payment.currency).toUpperCase() : null,
      refundAmountMode: null,
      rawPayload: { id: payment.id, status: payment.status, order_id: payment.order_id },
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      return {
        refundId: `rfnd_sandbox_${createId().slice(0, 12)}`,
        status: "processed",
        rawResponse: { sandbox: true, intentId: input.providerIntentId },
      };
    }

    if (!input.providerChargeId) {
      throw new PaymentError("Razorpay payment charge ID is required to process refunds.");
    }

    const rzp = this.getClient();
    const refund = await rzp.payments.refund(input.providerChargeId, {
      amount: toMinorUnits(input.amountDecimal, input.currency),
      notes: input.reason ? { reason: input.reason } : undefined,
    });

    return {
      refundId: refund.id,
      status: refund.status ?? "processed",
      rawResponse: { id: refund.id, status: refund.status },
    };
  }

  /**
   * Razorpay orders cannot be voided; an unpaid order simply expires. A late capture is caught by
   * the webhook handler, which auto-refunds payments on cancelled orders.
   */
  async cancelPaymentIntent(_providerIntentId: string): Promise<boolean> {
    return true;
  }

  async getClientSecret(_providerIntentId: string): Promise<string | null> {
    return null;
  }
}

export function buildSignedSandboxRazorpayWebhook(params: {
  eventType: "payment.captured" | "payment.failed";
  razorpayOrderId: string;
  orderId: string;
  orderNumber: string;
  failureMessage?: string;
  amountMinor?: number;
  currency?: string;
}): { rawBody: string; signatureHeader: string } {
  const secret = env.RAZORPAY_WEBHOOK_SECRET ?? env.BETTER_AUTH_SECRET;
  const rawBody = JSON.stringify({
    event_id: `evt_rzp_${createId()}`,
    event: params.eventType,
    payload: {
      payment: {
        entity: {
          id: `pay_sandbox_${createId()}`,
          order_id: params.razorpayOrderId,
          error_description: params.failureMessage ?? null,
          ...(params.amountMinor !== undefined ? { amount: params.amountMinor } : {}),
          ...(params.currency ? { currency: params.currency.toUpperCase() } : {}),
          notes: {
            orderId: params.orderId,
            orderNumber: params.orderNumber,
          },
        },
      },
    },
  });

  const signatureHeader = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return { rawBody, signatureHeader };
}
