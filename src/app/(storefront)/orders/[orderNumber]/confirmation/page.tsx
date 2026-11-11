import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { ConfirmationPrintButton } from "@/components/storefront/ConfirmationPrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { getOrderConfirmation, type OrderConfirmationDTO } from "@/modules/orders/order.service";
import { ORDER_STATUS_META, isCancellableBeforeSettlement } from "@/modules/orders/state-machine";
import { AppError } from "@/server/errors";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Private confirmation receipt and vault status for your commission.",
  robots: { index: false, follow: false },
};

async function ConfirmationBody({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ orderNumber }, { token }] = await Promise.all([params, searchParams]);

  let order: OrderConfirmationDTO | null = null;
  let errorMessage: string | null = null;

  try {
    order = await getOrderConfirmation(decodeURIComponent(orderNumber), token ?? null);
  } catch (err) {
    errorMessage =
      err instanceof AppError ? err.message : "Unable to load this order confirmation record.";
  }

  if (!order) {
    return (
      <Section spacing="sm">
        <Container className="max-w-2xl">
          <div className="rounded-md border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-9 text-accent" aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-medium text-foreground">
              Order Verification Required
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/login">Sign In to Account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact?type=GENERAL">Contact Concierge</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const needsRetry =
    isCancellableBeforeSettlement(order.status) &&
    (!order.reservedUntil || new Date(order.reservedUntil) > new Date());
  const retryHref = `/checkout?order=${encodeURIComponent(order.orderNumber)}${
    token ? `&token=${encodeURIComponent(token)}` : ""
  }`;

  return (
    <Section spacing="sm">
      <Container>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: `Order ${order.orderNumber}` }]}
        />

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="font-sans text-editorial-label text-accent-text">
                {order.status === "PAID" ? "Commission Confirmed" : "Commission Status"}
              </p>
              <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
            </div>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-foreground">
              Order {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {needsRetry && (
              <Button asChild>
                <Link href={retryHref}>Complete Payment</Link>
              </Button>
            )}
            <ConfirmationPrintButton />
            <Button asChild variant="outline">
              <Link href="/collections">Continue Exploring</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Items Snapshot */}
            <section className="rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-2xl font-medium text-foreground">Reserved Pieces</h2>
              <ul className="mt-4 divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-4">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                      {item.imageUrlSnapshot ? (
                        <Image
                          src={item.imageUrlSnapshot}
                          alt={item.titleSnapshot}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-medium text-foreground">
                        {item.titleSnapshot}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.variantTitleSnapshot} · SKU {item.skuSnapshot}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoneyExact(item.unitPrice, order.currency)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-foreground tabular-nums-price">
                      {formatMoneyExact(item.lineTotal, order.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Timeline */}
            <section className="rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-2xl font-medium text-foreground">
                Atelier Status History
              </h2>
              <ol className="mt-4 space-y-4">
                {order.events.map((evt) => {
                  const evtMeta = ORDER_STATUS_META[evt.toStatus];
                  return (
                    <li key={evt.id} className="flex items-start gap-3">
                      {evt.toStatus === "PAID" || evt.toStatus === "DELIVERED" ? (
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                      ) : (
                        <Clock
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{evtMeta.label}</p>
                        {evt.note && <p className="text-xs text-muted-foreground">{evt.note}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(evt.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <section className="rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-2xl font-medium text-foreground">Payment Summary</h2>
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(order.subtotal, order.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{order.shippingMethodName}</dt>
                  <dd className="font-medium text-foreground tabular-nums-price">
                    {order.shippingCost === "0.00"
                      ? "Complimentary"
                      : formatMoneyExact(order.shippingCost, order.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(order.taxAmount, order.currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <dt className="font-display text-lg font-medium text-foreground">Total</dt>
                  <dd className="font-display text-xl font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(order.total, order.currency)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-accent" aria-hidden="true" />
                <h2 className="font-display text-xl font-medium text-foreground">
                  Delivery Address
                </h2>
              </div>
              <address className="mt-3 space-y-0.5 text-sm text-muted-foreground not-italic">
                <p className="font-medium text-foreground">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{formatCountryName(order.shippingAddress.country)}</p>
                <p className="pt-1 text-xs">{order.shippingAddress.phone}</p>
              </address>

              {order.signatureRequired && (
                <p className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <span>Adult signature verification required upon insured handover.</span>
                </p>
              )}
            </section>
          </aside>
        </div>
      </Container>
    </Section>
  );
}

export default function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">
              Loading your order confirmation…
            </div>
          </Container>
        </Section>
      }
    >
      <ConfirmationBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
