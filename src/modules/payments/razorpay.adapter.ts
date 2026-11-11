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

  get isSandbox(): boolean {
    return env.PAYMENT_TEST_SANDBOX === "true" || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET;
  }

  private getClient(): Razorpay {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new PaymentError("Razorpay API credentials are not configured.");
    }
    return new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
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

    let status: VerifiedWebhookEvent["status"] = "ignored";
    if (eventType === "payment.captured" || eventType === "order.paid") {
      status = "succeeded";
    } else if (eventType === "payment.failed") {
      status = "failed";
    } else if (eventType === "refund.processed") {
      status = "refunded";
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
      rawPayload: parsed,
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
}

export function buildSignedSandboxRazorpayWebhook(params: {
  eventType: "payment.captured" | "payment.failed";
  razorpayOrderId: string;
  orderId: string;
  orderNumber: string;
  failureMessage?: string;
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
