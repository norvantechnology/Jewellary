import "server-only";
import type { PaymentProviderType } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import type { PaymentProviderAdapter } from "@/modules/payments/payment.types";
import { RazorpayPaymentAdapter } from "@/modules/payments/razorpay.adapter";
import { StripePaymentAdapter } from "@/modules/payments/stripe.adapter";

export function getActivePaymentProviderType(): PaymentProviderType {
  return env.PAYMENT_PROVIDER === "razorpay" ? "RAZORPAY" : "STRIPE";
}

export function getPaymentProvider(override?: PaymentProviderType): PaymentProviderAdapter {
  const target = override ?? getActivePaymentProviderType();
  return target === "RAZORPAY" ? new RazorpayPaymentAdapter() : new StripePaymentAdapter();
}

export interface CheckoutClientPaymentConfig {
  provider: PaymentProviderType;
  sandboxMode: boolean;
  stripePublishableKey: string | null;
  razorpayKeyId: string | null;
}

export function getCheckoutPaymentClientConfig(): CheckoutClientPaymentConfig {
  const adapter = getPaymentProvider();
  return {
    provider: adapter.provider,
    sandboxMode: adapter.isSandbox,
    stripePublishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    razorpayKeyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
  };
}
