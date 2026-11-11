import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ConfirmationPrintButton } from "@/components/storefront/ConfirmationPrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import type { OrderConfirmationDTO } from "@/modules/orders/order.service";
import { ORDER_STATUS_META, isCancellableBeforeSettlement } from "@/modules/orders/state-machine";

interface OrderDetailViewProps {
  order: OrderConfirmationDTO;
  guestToken?: string | null;
  secondaryAction?: {
    href: string;
    label: string;
  };
}

export function OrderDetailView({ order, guestToken, secondaryAction }: OrderDetailViewProps) {
  const meta = ORDER_STATUS_META[order.status];
  const needsRetry =
    isCancellableBeforeSettlement(order.status) &&
    (!order.reservedUntil || new Date(order.reservedUntil) > new Date());
  const retryHref = `/checkout?order=${encodeURIComponent(order.orderNumber)}${
    guestToken ? `&token=${encodeURIComponent(guestToken)}` : ""
  }`;
  const hasRefund = Number(order.refundedAmount) > 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="font-sans text-editorial-label text-accent-text">
              {order.status === "PAID" || order.status === "DELIVERED"
                ? "Commission Confirmed"
                : "Commission Status"}
            </p>
            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
          </div>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Order {order.orderNumber}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDate(order.createdAt)} · {meta.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {needsRetry && (
            <Button asChild>
              <Link href={retryHref}>Complete Payment</Link>
            </Button>
          )}
          <ConfirmationPrintButton />
          {secondaryAction && (
            <Button asChild variant="outline">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      </div>

      {(order.carrier || order.trackingNumber || order.trackingUrl) && (
        <section className="mt-6 rounded-md border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <PackageCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <h3 className="font-display text-lg font-medium text-foreground">
                  Insured Courier Dispatch
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {order.carrier ? `Carrier: ${order.carrier}` : "Insured Express"}
                  {order.trackingNumber ? ` · Waybill ${order.trackingNumber}` : ""}
                </p>
              </div>
            </div>
            {order.trackingUrl && (
              <Button asChild variant="outline" size="sm" className="print:hidden">
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                  Track Shipment
                  <ExternalLink className="ml-1.5 size-3.5" aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-md border border-border bg-card p-6">
            <h3 className="font-display text-2xl font-medium text-foreground">Pieces</h3>
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
            {order.giftNote && (
              <div className="mt-4 rounded-sm border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Gift Note: </span>
                {order.giftNote}
              </div>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-6">
            <h3 className="font-display text-2xl font-medium text-foreground">
              Atelier Status History
            </h3>
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
            <h3 className="font-display text-2xl font-medium text-foreground">Payment Summary</h3>
            <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium text-foreground tabular-nums-price">
                  {formatMoneyExact(order.subtotal, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{order.shippingMethodName}</dt>
                <dd className="font-medium text-foreground tabular-nums-price">
                  {order.shippingCost === "0.00"
                    ? "Complimentary"
                    : formatMoneyExact(order.shippingCost, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="font-medium text-foreground tabular-nums-price">
                  {formatMoneyExact(order.taxAmount, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-3">
                <dt className="font-display text-lg font-medium text-foreground">Total</dt>
                <dd className="font-display text-xl font-medium text-foreground tabular-nums-price">
                  {formatMoneyExact(order.total, order.currency)}
                </dd>
              </div>
              {hasRefund && (
                <div className="flex justify-between gap-2 border-t border-border pt-2 text-xs text-accent-text">
                  <dt>Refunded</dt>
                  <dd className="font-medium tabular-nums-price">
                    -{formatMoneyExact(order.refundedAmount, order.currency)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-md border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-accent" aria-hidden="true" />
              <h3 className="font-display text-xl font-medium text-foreground">Delivery Address</h3>
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

          <section className="rounded-md border border-border bg-card p-6">
            <h3 className="font-display text-xl font-medium text-foreground">Billing Address</h3>
            <address className="mt-3 space-y-0.5 text-sm text-muted-foreground not-italic">
              <p className="font-medium text-foreground">{order.billingAddress.fullName}</p>
              <p>{order.billingAddress.line1}</p>
              {order.billingAddress.line2 && <p>{order.billingAddress.line2}</p>}
              <p>
                {order.billingAddress.city}, {order.billingAddress.state}{" "}
                {order.billingAddress.postalCode}
              </p>
              <p>{formatCountryName(order.billingAddress.country)}</p>
            </address>
          </section>
        </aside>
      </div>
    </div>
  );
}
