import "server-only";
import { createId } from "@paralleldrive/cuid2";
import Stripe from "stripe";
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

export class StripePaymentAdapter implements PaymentProviderAdapter {
  readonly provider = "STRIPE" as const;

  get isSandbox(): boolean {
    return env.PAYMENT_TEST_SANDBOX === "true" || !env.STRIPE_SECRET_KEY;
  }

  private getClient(): Stripe {
    if (!env.STRIPE_SECRET_KEY) {
      throw new PaymentError("Stripe secret key is not configured on the server.");
    }
    return new Stripe(env.STRIPE_SECRET_KEY);
  }

  private getWebhookSecret(): string {
    if (env.STRIPE_WEBHOOK_SECRET) {
      return env.STRIPE_WEBHOOK_SECRET;
    }
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      return env.BETTER_AUTH_SECRET;
    }
    throw new PaymentError("Stripe webhook signing secret is not configured.");
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      const intentId = `pi_sandbox_${input.orderId.slice(-10)}_${createId().slice(0, 8)}`;
      const clientSecret = `${intentId}_secret_${createId().slice(0, 12)}`;
      return {
        provider: "STRIPE",
        providerIntentId: intentId,
        clientSecret,
        razorpayOrderId: null,
        keyId: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
        mode: "sandbox",
        rawResponse: {
          sandbox: true,
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          amountMinor: toMinorUnits(input.amountDecimal, input.currency),
          currency: input.currency.toLowerCase(),
        },
      };
    }

    const stripe = this.getClient();
    const amountMinor = toMinorUnits(input.amountDecimal, input.currency);

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountMinor,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        metadata: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
        },
      },
      { idempotencyKey: `order_intent_${input.idempotencyKey}` },
    );

    return {
      provider: "STRIPE",
      providerIntentId: intent.id,
      clientSecret: intent.client_secret,
      razorpayOrderId: null,
      keyId: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
      mode: "live",
      rawResponse: { id: intent.id, status: intent.status },
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signatureHeader) {
      throw new ValidationError("Missing Stripe signature header.");
    }

    const secret = this.getWebhookSecret();
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
    } catch {
      throw new ValidationError("Invalid Stripe webhook signature.");
    }

    const obj = event.data.object as unknown as Record<string, unknown>;
    const metadata =
      obj && typeof obj.metadata === "object" && obj.metadata !== null
        ? (obj.metadata as Record<string, unknown>)
        : {};

    let status: VerifiedWebhookEvent["status"] = "ignored";
    let intentId: string | null = typeof obj?.id === "string" ? obj.id : null;
    let chargeId: string | null = typeof obj?.latest_charge === "string" ? obj.latest_charge : null;
    let failureReason: string | null = null;

    if (event.type === "payment_intent.succeeded") {
      status = "succeeded";
    } else if (event.type === "payment_intent.payment_failed") {
      status = "failed";
      const lastError = obj?.last_payment_error as Record<string, unknown> | undefined;
      failureReason =
        typeof lastError?.message === "string" ? lastError.message : "Card authorization failed.";
    } else if (event.type === "charge.refunded") {
      status = "refunded";
      if (typeof obj?.payment_intent === "string") {
        intentId = obj.payment_intent;
      }
      if (typeof obj?.id === "string") {
        chargeId = obj.id;
      }
    }

    return {
      provider: "STRIPE",
      eventId: event.id,
      eventType: event.type,
      intentId,
      chargeId,
      orderIdFromMetadata: typeof metadata.orderId === "string" ? metadata.orderId : null,
      orderNumberFromMetadata:
        typeof metadata.orderNumber === "string" ? metadata.orderNumber : null,
      status,
      failureReason,
      rawPayload: event,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    if (env.PAYMENT_TEST_SANDBOX === "true") {
      return {
        refundId: `re_sandbox_${createId().slice(0, 12)}`,
        status: "succeeded",
        rawResponse: {
          sandbox: true,
          intentId: input.providerIntentId,
          amountMinor: toMinorUnits(input.amountDecimal, input.currency),
        },
      };
    }

    const stripe = this.getClient();
    const refund = await stripe.refunds.create({
      payment_intent: input.providerIntentId,
      amount: toMinorUnits(input.amountDecimal, input.currency),
      reason: "requested_by_customer",
    });

    return {
      refundId: refund.id,
      status: refund.status ?? "succeeded",
      rawResponse: { id: refund.id, status: refund.status },
    };
  }
}

export function buildSignedSandboxStripeWebhook(params: {
  eventType: "payment_intent.succeeded" | "payment_intent.payment_failed";
  intentId: string;
  orderId: string;
  orderNumber: string;
  failureMessage?: string;
}): { rawBody: string; signatureHeader: string } {
  const secret = env.STRIPE_WEBHOOK_SECRET ?? env.BETTER_AUTH_SECRET;
  const payload = JSON.stringify({
    id: `evt_sandbox_${createId()}`,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: params.eventType,
    data: {
      object: {
        id: params.intentId,
        object: "payment_intent",
        latest_charge:
          params.eventType === "payment_intent.succeeded" ? `ch_sandbox_${createId()}` : null,
        last_payment_error: params.failureMessage ? { message: params.failureMessage } : null,
        metadata: {
          orderId: params.orderId,
          orderNumber: params.orderNumber,
        },
      },
    },
  });

  const signatureHeader = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  return { rawBody: payload, signatureHeader };
}
