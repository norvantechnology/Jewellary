"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/motion/Reveal";
import { AbuseProtectionFields } from "@/components/shared/AbuseProtectionFields";
import { FormField } from "@/components/shared/FormField";
import { OrderDetailView } from "@/components/storefront/OrderDetailView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAbuseProtection } from "@/hooks/use-abuse-protection";
import { lookupGuestOrderAction } from "@/modules/account/account.actions";
import type { GuestOrderTrackResultDTO } from "@/modules/account/account.service";

export function GuestOrderTrackClient({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const [orderNumber, setOrderNumber] = React.useState(initialOrderNumber ?? "");
  const [email, setEmail] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<GuestOrderTrackResultDTO | null>(null);
  const abuse = useAbuseProtection();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    startTransition(async () => {
      const res = await lookupGuestOrderAction({
        orderNumber,
        email,
        website: abuse.website,
        timingToken: abuse.timingToken,
        turnstileToken: abuse.turnstileToken,
      });
      if (!res.ok) {
        setErrorMsg(res.error.message);
        setFieldErrors(res.error.fieldErrors ?? {});
        setResult(null);
        abuse.refreshToken();
        return;
      }
      setResult(res.data);
      abuse.refreshToken();
    });
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            id="track-order-number"
            label="Order Number"
            required
            error={fieldErrors.orderNumber?.[0]}
            hint="In your confirmation email, e.g. ORD-2026-10001."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="ORD-2026-10001"
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FormField
            id="track-order-email"
            label="Email Address"
            required
            error={fieldErrors.email?.[0]}
            hint="The email address entered during checkout."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                autoComplete="email"
                required
              />
            )}
          </FormField>

          {errorMsg && (
            <p
              role="alert"
              className="ma-error-shake rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMsg}
            </p>
          )}

          <AbuseProtectionFields
            website={abuse.website}
            onWebsiteChange={abuse.setWebsite}
            turnstileSiteKey={abuse.turnstileSiteKey}
            onTurnstileToken={abuse.setTurnstileToken}
          />

          <Button type="submit" loading={pending} size="lg" className="w-full sm:w-auto">
            <Search className="size-5 stroke-[1.5]" aria-hidden="true" />
            <span>Track Order</span>
          </Button>
        </form>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Have an account?{" "}
          <Link
            href="/account/orders"
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
          >
            View your orders
          </Link>
          .
        </p>
      </div>

      {result && (
        <FadeIn className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-8">
          <OrderDetailView
            order={result.order}
            guestToken={result.accessToken}
            secondaryAction={{
              href: `/orders/${encodeURIComponent(result.order.orderNumber)}/confirmation?token=${encodeURIComponent(result.accessToken)}`,
              label: "Open Printable Receipt",
            }}
          />
        </FadeIn>
      )}
    </div>
  );
}
