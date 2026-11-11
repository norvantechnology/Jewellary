import type { PaymentProviderType } from "@/generated/prisma/client";

export interface CreatePaymentIntentInput {
  orderId: string;
  orderNumber: string;
  amountDecimal: string;
  currency: string;
  customerEmail: string;
  idempotencyKey: string;
}

export interface CreatePaymentIntentResult {
  provider: PaymentProviderType;
  providerIntentId: string;
  clientSecret: string | null;
  razorpayOrderId: string | null;
  keyId: string | null;
  mode: "live" | "sandbox";
  rawResponse?: unknown;
}

export interface VerifiedWebhookEvent {
  provider: PaymentProviderType;
  eventId: string;
  eventType: string;
  intentId: string | null;
  chargeId: string | null;
  orderIdFromMetadata: string | null;
  orderNumberFromMetadata: string | null;
  status: "succeeded" | "failed" | "refunded" | "ignored";
  failureReason: string | null;
  rawPayload: unknown;
}

export interface CreateRefundInput {
  providerIntentId: string;
  providerChargeId?: string | null;
  amountDecimal: string;
  currency: string;
  reason?: string;
}

export interface CreateRefundResult {
  refundId: string;
  status: string;
  rawResponse?: unknown;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderType;
  readonly isSandbox: boolean;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<VerifiedWebhookEvent>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
}
