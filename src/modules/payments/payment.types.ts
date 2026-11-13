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
  /** Amount captured (succeeded) or refunded (refunded), in provider minor units. Null if absent. */
  amountMinor: number | null;
  /** ISO currency code of `amountMinor`, upper-cased. */
  currency: string | null;
  /**
   * How a refund amount should be applied: Stripe reports the charge's cumulative refunded total,
   * Razorpay reports each refund individually.
   */
  refundAmountMode: "cumulative" | "incremental" | null;
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
  /**
   * Voids an unpaid intent so it can no longer be charged. Must be a no-op (not throw) when the
   * intent is already cancelled, succeeded, or the provider has no cancel concept.
   * Returns false if the intent had already been captured.
   */
  cancelPaymentIntent(providerIntentId: string): Promise<boolean>;
  /** Re-reads the client secret of an open intent (Stripe). Null when not applicable. */
  getClientSecret(providerIntentId: string): Promise<string | null>;
}
