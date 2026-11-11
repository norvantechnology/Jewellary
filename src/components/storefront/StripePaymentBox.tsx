"use client";

import * as React from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoneyExact } from "@/lib/money";

interface StripePaymentFormProps {
  orderNumber: string;
  guestToken: string | null;
  total: string;
  currency: string;
}

function StripePaymentForm({ orderNumber, guestToken, total, currency }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    const tokenQuery = guestToken ? `?token=${encodeURIComponent(guestToken)}` : "";
    const returnUrl = `${window.location.origin}/orders/${encodeURIComponent(orderNumber)}/confirmation${tokenQuery}`;

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (result.error) {
      const msg = result.error.message ?? "Payment authorization failed.";
      setErrorMessage(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4">
      <PaymentElement />
      {errorMessage && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || submitting}>
        <Lock className="size-4" aria-hidden="true" />
        <span>
          {submitting ? "Authorizing Payment…" : `Authorize ${formatMoneyExact(total, currency)}`}
        </span>
      </Button>
    </form>
  );
}

const DEFAULT_APPEARANCE_JSON = JSON.stringify({
  theme: "flat",
  variables: {
    fontFamily: "var(--font-jost), system-ui, sans-serif",
    borderRadius: "4px",
  },
} satisfies Appearance);

function subscribeThemeChange(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getAppearanceSnapshot(): string {
  const styles = getComputedStyle(document.documentElement);
  const readVar = (name: string) => styles.getPropertyValue(name).trim() || undefined;
  const isDark = document.documentElement.classList.contains("dark");
  return JSON.stringify({
    theme: isDark ? "night" : "flat",
    variables: {
      colorPrimary: readVar("--accent"),
      colorBackground: readVar("--card"),
      colorText: readVar("--foreground"),
      colorTextSecondary: readVar("--muted-foreground"),
      colorDanger: readVar("--destructive"),
      fontFamily: "var(--font-jost), system-ui, sans-serif",
      borderRadius: "4px",
    },
  } satisfies Appearance);
}

interface StripePaymentBoxProps {
  publishableKey: string;
  clientSecret: string;
  orderNumber: string;
  guestToken: string | null;
  total: string;
  currency: string;
}

export function StripePaymentBox(props: StripePaymentBoxProps) {
  const stripePromise = React.useMemo(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );
  const appearanceJson = React.useSyncExternalStore(
    subscribeThemeChange,
    getAppearanceSnapshot,
    () => DEFAULT_APPEARANCE_JSON,
  );
  const appearance = React.useMemo(
    () => JSON.parse(appearanceJson) as Appearance,
    [appearanceJson],
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance }}>
      <StripePaymentForm
        orderNumber={props.orderNumber}
        guestToken={props.guestToken}
        total={props.total}
        currency={props.currency}
      />
    </Elements>
  );
}
