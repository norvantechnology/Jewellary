"use client";
import { fill, fillNodes, useUiText } from "@/components/providers/UiTextProvider";

import { LocalDate } from "@/components/shared/LocalDate";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import { acceptCustomizationQuoteToBagAction } from "@/modules/customization/customization.actions";
import type { QuoteTokenResolution } from "@/modules/customization/customization.service";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface QuoteAcceptClientProps {
  token: string;
  resolution: QuoteTokenResolution;
}

export function QuoteAcceptClient({ token, resolution }: QuoteAcceptClientProps) {
  const ui = useUiText();
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  async function handleAcceptAndCheckout() {
    setSubmitting(true);
    const res = await acceptCustomizationQuoteToBagAction({ token });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    visitorStore.setLatestCart(res.data);
    toast.success(ui.customize.quote.acceptedToast);
    router.push("/checkout");
  }

  if (resolution.state === "REQUIRES_LOGIN") {
    const nextUrl = `/customize/accept/${encodeURIComponent(token)}`;
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <ShieldCheck className="mx-auto size-10 text-accent-text" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          {ui.customize.quote.loginTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fillNodes(ui.customize.quote.loginText, {
            number: resolution.requestNumber ? <strong>{resolution.requestNumber}</strong> : null,
          })}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="min-h-11">
            <Link href={`/login?next=${encodeURIComponent(nextUrl)}`}>
              {ui.customize.quote.loginButton}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (resolution.state === "EXPIRED") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <Clock className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          {ui.customize.quote.expiredTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fillNodes(ui.customize.quote.expiredText, {
            number: resolution.requestNumber ? (
              <strong>{resolution.requestNumber}</strong>
            ) : (
              ui.customize.quote.expiredNumberFallback
            ),
          })}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {resolution.productSlug ? (
            <Button asChild className="min-h-11">
              <Link href={`/products/${resolution.productSlug}/customize`}>
                {ui.customize.quote.requestFresh}
              </Link>
            </Button>
          ) : null}
          {resolution.requestId ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/account/customizations/${resolution.requestId}`}>
                {ui.customize.quote.viewOriginal}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (resolution.state === "USED") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <CheckCircle2 className="mx-auto size-10 text-accent-text" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          {ui.customize.quote.claimedTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fillNodes(ui.customize.quote.claimedText, {
            number: resolution.requestNumber ? <strong>{resolution.requestNumber}</strong> : "",
          })}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="min-h-11">
            <Link href="/cart">{ui.customize.quote.goToBag}</Link>
          </Button>
          {resolution.requestId ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/account/customizations/${resolution.requestId}`}>
                {ui.customize.quote.viewRequest}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (resolution.state !== "VALID") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {ui.customize.quote.unavailableTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{ui.customize.quote.unavailableText}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/collections">{ui.customize.quote.browse}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-accent-text uppercase">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>
              {fill(ui.customize.quote.approvedLabel, { number: resolution.requestNumber })}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {fillNodes(ui.customize.quote.validUntil, {
              date: <LocalDate value={resolution.quoteExpiresAt} />,
            })}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {resolution.productImageUrl ? (
              <Image
                src={resolution.productImageUrl}
                alt={resolution.productName}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                {ui.customize.quote.imagePlaceholder}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{resolution.productName}</h1>
            <p className="text-sm text-muted-foreground">
              {fill(ui.customize.quote.preparedFor, {
                name: resolution.customerName,
                email: resolution.customerEmail,
              })}
            </p>
            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <span className="text-sm text-muted-foreground">
                {ui.customize.quote.lockedPrice}
              </span>
              <Price
                amount={resolution.lockedPriceBase}
                size="lg"
                className="font-semibold text-foreground"
              />
            </div>
            {resolution.estimatedDeliveryDays ? (
              <p className="text-xs text-muted-foreground">
                {fill(ui.customize.quote.craftingTime, { days: resolution.estimatedDeliveryDays })}
              </p>
            ) : null}
          </div>
        </div>

        {resolution.adminMessage ? (
          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {ui.customize.quote.noteHeading}
            </p>
            <p className="mt-1 text-sm text-foreground">{resolution.adminMessage}</p>
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">
            {ui.customize.quote.specsHeading}
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resolution.selections.map((sel) => (
              <div
                key={sel.groupCode}
                className="rounded-lg border border-border bg-background/60 px-3.5 py-2.5"
              >
                <dt className="text-xs text-muted-foreground">{sel.groupLabel}</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{sel.displayValue}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{ui.customize.quote.lockedNote}</p>
          <Button
            type="button"
            size="lg"
            className="min-h-11 w-full sm:w-auto"
            disabled={submitting}
            onClick={handleAcceptAndCheckout}
          >
            {submitting ? ui.customize.quote.accepting : ui.customize.quote.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
