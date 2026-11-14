"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

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
  const ui = useUiText();
  const t = ui.track;

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
            label={t.orderNumberLabel}
            required
            error={fieldErrors.orderNumber?.[0]}
            hint={t.orderNumberHint}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder={t.orderNumberPlaceholder}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FormField
            id="track-order-email"
            label={t.emailLabel}
            required
            error={fieldErrors.email?.[0]}
            hint={t.emailHint}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
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
            <span>{t.submit}</span>
          </Button>
        </form>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          {t.haveAccount}{" "}
          <Link
            href="/account/orders"
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
          >
            {t.viewOrders}
          </Link>
          .
        </p>
      </div>

      {result && (
        <FadeIn className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-8">
          <OrderDetailView
            order={result.order}
            guestToken={result.accessToken}
            text={ui.orders}
            secondaryAction={{
              href: `/orders/${encodeURIComponent(result.order.orderNumber)}/confirmation?token=${encodeURIComponent(result.accessToken)}`,
              label: t.printableReceipt,
            }}
          />
        </FadeIn>
      )}
    </div>
  );
}
