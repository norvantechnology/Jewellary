import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmationPrintButton } from "@/components/storefront/ConfirmationPrintButton";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { getAdminOrderDetail } from "@/modules/orders/admin-orders.service";
import { requirePermission } from "@/server/dal";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = {
  title: "Commercial Invoice & Packing Slip",
};

export default async function AdminOrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [, { id }] = await Promise.all([requirePermission("orders:read"), params]);

  let order;
  try {
    order = await getAdminOrderDetail(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to Order {order.orderNumber}
        </Link>
        <ConfirmationPrintButton />
      </div>

      {/* Commercial Invoice */}
      <article className="rounded-md border border-border bg-card p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-editorial-label text-accent-text">{order.store.storeName}</p>
            <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
              Commercial Invoice
            </h1>
            {order.store.physicalStore?.address && (
              <p className="mt-1 text-xs text-muted-foreground">
                {order.store.physicalStore.address}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {order.store.contactEmail}
              {order.store.contactPhone ? ` · ${order.store.contactPhone}` : ""}
            </p>
          </div>
          <dl className="space-y-1 text-right text-sm">
            <div>
              <dt className="inline text-muted-foreground">Invoice / Order: </dt>
              <dd className="inline font-medium text-foreground">{order.orderNumber}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Date Issued: </dt>
              <dd className="inline text-foreground">{formatDate(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Status: </dt>
              <dd className="inline text-foreground">{order.status}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Bill To
            </h2>
            <address className="mt-2 space-y-0.5 text-sm text-foreground not-italic">
              <p className="font-medium">{order.billingAddress.fullName}</p>
              <p>{order.billingAddress.line1}</p>
              {order.billingAddress.line2 && <p>{order.billingAddress.line2}</p>}
              <p>
                {order.billingAddress.city}, {order.billingAddress.state}{" "}
                {order.billingAddress.postalCode}
              </p>
              <p>{formatCountryName(order.billingAddress.country)}</p>
              <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
            </address>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Ship To ({order.shippingMethodName})
            </h2>
            <address className="mt-2 space-y-0.5 text-sm text-foreground not-italic">
              <p className="font-medium">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{formatCountryName(order.shippingAddress.country)}</p>
              <p className="text-xs text-muted-foreground">{order.shippingAddress.phone}</p>
            </address>
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="py-2.5 pr-3">Piece</th>
              <th className="py-2.5 pr-3">SKU</th>
              <th className="py-2.5 pr-3 text-right">Qty</th>
              <th className="py-2.5 pr-3 text-right">Unit Price</th>
              <th className="py-2.5 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-3">
                  <p className="font-medium text-foreground">{item.titleSnapshot}</p>
                  <p className="text-xs text-muted-foreground">{item.variantTitleSnapshot}</p>
                </td>
                <td className="py-3 pr-3 text-xs text-muted-foreground">{item.skuSnapshot}</td>
                <td className="py-3 pr-3 text-right tabular-nums-price">{item.quantity}</td>
                <td className="py-3 pr-3 text-right tabular-nums-price">
                  {formatMoneyExact(item.unitPrice, order.currency)}
                </td>
                <td className="py-3 text-right font-medium tabular-nums-price">
                  {formatMoneyExact(item.lineTotal, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums-price">
                {formatMoneyExact(order.subtotal, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums-price">
                {formatMoneyExact(order.shippingCost, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums-price">
                {formatMoneyExact(order.taxAmount, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <dt>Invoice Total</dt>
              <dd className="font-display text-lg tabular-nums-price">
                {formatMoneyExact(order.total, order.currency)}
              </dd>
            </div>
            {Number(order.refundedAmount) > 0 && (
              <div className="flex justify-between text-xs text-accent-text">
                <dt>Refunded</dt>
                <dd className="tabular-nums-price">
                  -{formatMoneyExact(order.refundedAmount, order.currency)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </article>

      {/* Atelier Packing Slip */}
      <article className="rounded-md border border-border bg-card p-6 sm:p-10 print:break-before-page">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-editorial-label text-accent-text">{order.store.storeName}</p>
            <h2 className="mt-1 font-display text-2xl font-medium text-foreground">
              Atelier Packing Slip
            </h2>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-foreground">Order {order.orderNumber}</p>
            {order.signatureRequired && (
              <p className="text-xs font-medium text-accent-text">
                ADULT SIGNATURE REQUIRED AT HANDOVER
              </p>
            )}
          </div>
        </header>

        <ul className="mt-4 divide-y divide-border text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-foreground">{item.titleSnapshot}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantTitleSnapshot} · SKU {item.skuSnapshot}
                </p>
              </div>
              <span className="font-medium tabular-nums-price">Qty: {item.quantity}</span>
            </li>
          ))}
        </ul>

        {order.giftNote && (
          <div className="mt-4 rounded-sm border border-border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Gift Enclosure Card
            </p>
            <p className="mt-1 text-foreground">{order.giftNote}</p>
          </div>
        )}
      </article>
    </div>
  );
}
