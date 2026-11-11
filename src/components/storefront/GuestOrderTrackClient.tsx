"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FormField } from "@/components/shared/FormField";
import { OrderDetailView } from "@/components/storefront/OrderDetailView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupGuestOrderAction } from "@/modules/account/account.actions";
import type { GuestOrderTrackResultDTO } from "@/modules/account/account.service";

export function GuestOrderTrackClient({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const [orderNumber, setOrderNumber] = React.useState(initialOrderNumber ?? "");
  const [email, setEmail] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<GuestOrderTrackResultDTO | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    startTransition(async () => {
      const res = await lookupGuestOrderAction({ orderNumber, email });
      if (!res.ok) {
        setErrorMsg(res.error.message);
        setFieldErrors(res.error.fieldErrors ?? {});
        setResult(null);
        return;
      }
      setResult(res.data);
    });
  }

  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-xl rounded-md border border-border bg-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            id="track-order-number"
            label="Order Number"
            required
            error={fieldErrors.orderNumber?.[0]}
            hint="Found in your confirmation email, e.g. MA-10001."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="MA-10001"
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
              className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMsg}
            </p>
          )}

          <Button type="submit" loading={pending} className="w-full sm:w-auto">
            <Search className="mr-2 size-4" aria-hidden="true" />
            Find Order Status
          </Button>
        </form>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Have a client account?{" "}
          <Link
            href="/account/orders"
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
          >
            View all commissions in your account
          </Link>
          .
        </p>
      </div>

      {result && (
        <div className="rounded-md border border-border bg-background p-6 sm:p-8">
          <OrderDetailView
            order={result.order}
            guestToken={result.accessToken}
            secondaryAction={{
              href: `/orders/${encodeURIComponent(result.order.orderNumber)}/confirmation?token=${encodeURIComponent(result.accessToken)}`,
              label: "Open Printable Receipt",
            }}
          />
        </div>
      )}
    </div>
  );
}
