"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/generated/prisma/client";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact, subtractMoney } from "@/lib/money";
import {
  adminRefundOrderAction,
  adminResendOrderEmailAction,
  adminUpdateOrderStatusAction,
} from "@/modules/orders/admin-orders.actions";
import type { AdminOrderDetailDTO } from "@/modules/orders/admin-orders.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";

interface AdminOrderDetailClientProps {
  order: AdminOrderDetailDTO;
  canRefund: boolean;
  canCancelPaid: boolean;
}

export function AdminOrderDetailClient({
  order,
  canRefund,
  canCancelPaid,
}: AdminOrderDetailClientProps) {
  const router = useRouter();
  const meta = ORDER_STATUS_META[order.status];

  const [toStatus, setToStatus] = React.useState<OrderStatus>(order.status);
  const [carrier, setCarrier] = React.useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = React.useState(order.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = React.useState(order.trackingUrl ?? "");
  const [internalNote, setInternalNote] = React.useState(order.internalNote ?? "");
  const [customerNote, setCustomerNote] = React.useState("");
  const [notifyCustomer, setNotifyCustomer] = React.useState(true);
  const [updatingStatus, startUpdatingStatus] = React.useTransition();
  const [resendingEmail, startResendingEmail] = React.useTransition();

  const remainingRefundable = subtractMoney(order.total, order.refundedAmount);
  const canInitiateRefund =
    canRefund &&
    ["PAID", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"].includes(order.status) &&
    remainingRefundable.gt(0);

  const [refundAmount, setRefundAmount] = React.useState(remainingRefundable.toFixed(2));
  const [refundReason, setRefundReason] = React.useState("");
  const [restoreStock, setRestoreStock] = React.useState(false);
  const [notifyRefund, setNotifyRefund] = React.useState(true);
  const [refundConfirmOpen, setRefundConfirmOpen] = React.useState(false);
  const [refunding, setRefunding] = React.useState(false);

  const selectableStatuses = React.useMemo(() => {
    const isPaidPreDispatch =
      order.status === "PAID" || order.status === "PROCESSING" || order.status === "PACKED";
    return order.allowedNextStatuses.filter((st) => {
      if (st === "CANCELLED" && isPaidPreDispatch && !canCancelPaid) return false;
      return true;
    });
  }, [order.allowedNextStatuses, order.status, canCancelPaid]);

  function handleSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    startUpdatingStatus(async () => {
      const res = await adminUpdateOrderStatusAction({
        orderId: order.id,
        toStatus,
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        trackingUrl: trackingUrl || null,
        internalNote: internalNote || null,
        customerNote: customerNote || null,
        notifyCustomer,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      toast.success(`Order ${order.orderNumber} updated`);
      setCustomerNote("");
      router.refresh();
    });
  }

  function handleResendConfirmation() {
    startResendingEmail(async () => {
      const res = await adminResendOrderEmailAction({ orderId: order.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Confirmation receipt queued for ${res.data.sentTo}`);
    });
  }

  async function handleConfirmRefund() {
    setRefunding(true);
    try {
      const res = await adminRefundOrderAction({
        orderId: order.id,
        amount: refundAmount,
        reason: refundReason,
        restoreStock,
        notifyCustomer: notifyRefund,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setRefunding(false);
        return;
      }
      toast.success(`Refund ${res.data.refundId} processed cleanly`);
      setRefundConfirmOpen(false);
      setRefundReason("");
      router.refresh();
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-editorial-label text-accent-text">Order Record</span>
            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
          </div>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground sm:text-4xl">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDate(order.createdAt)} · {order.customerName} ({order.customerEmail})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={resendingEmail}
            onClick={handleResendConfirmation}
          >
            <Mail className="mr-1.5 size-4" aria-hidden="true" />
            Resend Receipt Email
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/orders/${order.id}/invoice`}>
              <Printer className="mr-1.5 size-4" aria-hidden="true" />
              Invoice / Packing Slip
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Items Snapshot */}
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Commission Items</h2>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3.5">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                    {item.imageUrlSnapshot ? (
                      <Image
                        src={item.imageUrlSnapshot}
                        alt={item.titleSnapshot}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="font-medium text-foreground hover:text-accent-text"
                    >
                      {item.titleSnapshot}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.variantTitleSnapshot} · SKU {item.skuSnapshot}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatMoneyExact(item.unitPrice, order.currency)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(item.lineTotal, order.currency)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums-price">
                  {formatMoneyExact(order.subtotal, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{order.shippingMethodName}</dt>
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
                <dt>Total</dt>
                <dd className="font-display text-lg tabular-nums-price">
                  {formatMoneyExact(order.total, order.currency)}
                </dd>
              </div>
              {Number(order.refundedAmount) > 0 && (
                <div className="flex justify-between text-xs text-accent-text">
                  <dt>Total Refunded</dt>
                  <dd className="tabular-nums-price">
                    -{formatMoneyExact(order.refundedAmount, order.currency)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Payment Transactions */}
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Payment Ledger</h2>
            {order.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No payment records logged.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {p.provider} · {p.providerIntentId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {p.providerChargeId ? ` · Charge ${p.providerChargeId}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "SUCCEEDED" ? "success" : "outline"}>
                        {p.status}
                      </Badge>
                      <span className="font-medium tabular-nums-price">
                        {formatMoneyExact(p.amount, p.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Order Events Timeline */}
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Audit Timeline</h2>
            <ol className="mt-4 space-y-3">
              {order.events.map((evt) => (
                <li key={evt.id} className="border-l-2 border-border pl-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {ORDER_STATUS_META[evt.toStatus].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(evt.createdAt)}
                    </span>
                  </div>
                  {evt.note && <p className="mt-0.5 text-xs text-muted-foreground">{evt.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          {/* Status & Tracking Update Form */}
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">
              Fulfillment &amp; Status
            </h2>

            <form onSubmit={handleSaveStatus} className="mt-4 space-y-4">
              <FormField id="order-status-select" label="Order Status">
                {(fp) => (
                  <NativeSelect
                    {...fp}
                    value={toStatus}
                    onChange={(e) => setToStatus(e.target.value as OrderStatus)}
                  >
                    {selectableStatuses.map((st) => (
                      <option key={st} value={st}>
                        {ORDER_STATUS_META[st].label} ({st})
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="order-carrier" label="Courier Carrier">
                  {(fp) => (
                    <Input
                      {...fp}
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="Malca-Amit, Ferrari, FedEx Priority"
                    />
                  )}
                </FormField>
                <FormField id="order-tracking-number" label="Tracking / Waybill">
                  {(fp) => (
                    <Input
                      {...fp}
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="AWB-8849201"
                    />
                  )}
                </FormField>
              </div>

              <FormField id="order-tracking-url" label="Carrier Tracking URL">
                {(fp) => (
                  <Input
                    {...fp}
                    type="url"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://track.example.com/..."
                  />
                )}
              </FormField>

              <FormField id="order-customer-note" label="Client Timeline Note (Optional)">
                {(fp) => (
                  <Input
                    {...fp}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Visible to client on status timeline and email..."
                  />
                )}
              </FormField>

              <FormField id="order-internal-note" label="Internal Studio Note (Staff Only)">
                {(fp) => (
                  <Textarea
                    {...fp}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={3}
                    placeholder="Private appraisal, sizing, or vault notes..."
                  />
                )}
              </FormField>

              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="order-notify-customer"
                  checked={notifyCustomer}
                  onCheckedChange={(checked) => setNotifyCustomer(checked === true)}
                />
                <label
                  htmlFor="order-notify-customer"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Notify client by email
                </label>
              </div>

              <Button type="submit" loading={updatingStatus} className="w-full">
                Save Order Update
              </Button>
            </form>
          </section>

          {/* Refund Section (ADMIN only) */}
          {canInitiateRefund && (
            <section className="rounded-md border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-4 text-accent" aria-hidden="true" />
                <h2 className="font-display text-2xl font-medium text-foreground">
                  Issue Monetary Refund
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Remaining refundable balance:{" "}
                <span className="font-medium text-foreground">
                  {formatMoneyExact(remainingRefundable, order.currency)}
                </span>
              </p>

              <div className="mt-4 space-y-3">
                <FormField id="refund-amount" label={`Amount (${order.currency})`} required>
                  {(fp) => (
                    <Input
                      {...fp}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      inputMode="decimal"
                    />
                  )}
                </FormField>

                <FormField id="refund-reason" label="Refund Reason" required>
                  {(fp) => (
                    <Input
                      {...fp}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Client return, sizing adjustment, or order cancellation"
                    />
                  )}
                </FormField>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="refund-restore-stock"
                      checked={restoreStock}
                      disabled={order.stockAlreadyReturned}
                      onCheckedChange={(checked) => setRestoreStock(checked === true)}
                    />
                    <label
                      htmlFor="refund-restore-stock"
                      className="cursor-pointer text-sm text-foreground"
                    >
                      {order.stockAlreadyReturned
                        ? "Stock already restored for this order"
                        : "Restore returned items to vault stock"}
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="refund-notify-customer"
                      checked={notifyRefund}
                      onCheckedChange={(checked) => setNotifyRefund(checked === true)}
                    />
                    <label
                      htmlFor="refund-notify-customer"
                      className="cursor-pointer text-sm text-foreground"
                    >
                      Email refund confirmation to client
                    </label>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={refundReason.trim().length < 3 || Number(refundAmount) <= 0}
                  onClick={() => setRefundConfirmOpen(true)}
                >
                  Process Refund
                </Button>
              </div>
            </section>
          )}

          {/* Addresses Snapshot */}
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-xl font-medium text-foreground">
              Client &amp; Delivery Snapshot
            </h2>
            <div className="mt-3 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  Shipping Destination
                </p>
                <p className="mt-1 font-medium text-foreground">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{formatCountryName(order.shippingAddress.country)}</p>
                <p className="text-xs">{order.shippingAddress.phone}</p>
              </div>
              {order.userId && (
                <div className="border-t border-border pt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/customers/${order.userId}`}>View Client Profile</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={refundConfirmOpen}
        onOpenChange={setRefundConfirmOpen}
        title="Confirm Payment Refund"
        description={`Issue a monetary refund of ${order.currency} ${refundAmount} for order ${order.orderNumber}? This dispatches directly to the payment provider ledger.`}
        confirmLabel="Issue Refund"
        destructive
        loading={refunding}
        onConfirm={handleConfirmRefund}
      />
    </div>
  );
}
