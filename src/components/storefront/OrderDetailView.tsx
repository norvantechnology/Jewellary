import Image from "next/image";
import Link from "next/link";
import { CustomizedSpecsBadge } from "@/components/shared/CustomizedSpecsBadge";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { RevealStagger } from "@/components/motion/Reveal";
import { ConfirmationPrintButton } from "@/components/storefront/ConfirmationPrintButton";
import { OpenAtelierChatButton } from "@/components/storefront/OpenAtelierChatButton";
import { ReorderButton } from "@/components/storefront/ReorderButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { cn } from "@/lib/utils";
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

interface MilestoneStage {
  key: string;
  label: string;
  reached: boolean;
  active: boolean;
  timestamp: string | null;
}

function buildOrderMilestones(order: OrderConfirmationDTO): MilestoneStage[] {
  const isDelivered = order.status === "DELIVERED" || Boolean(order.deliveredAt);
  const isShipped = isDelivered || order.status === "SHIPPED" || Boolean(order.shippedAt);
  const isConfirmed =
    isShipped || order.status === "PAID" || order.status === "PROCESSING" || Boolean(order.paidAt);

  return [
    {
      key: "placed",
      label: "Placed",
      reached: true,
      active: order.status === "PENDING_PAYMENT",
      timestamp: order.createdAt,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      reached: isConfirmed,
      active: order.status === "PAID" || order.status === "PROCESSING",
      timestamp: order.paidAt,
    },
    {
      key: "shipped",
      label: "Shipped",
      reached: isShipped,
      active: order.status === "SHIPPED",
      timestamp: order.shippedAt,
    },
    {
      key: "delivered",
      label: "Delivered",
      reached: isDelivered,
      active: order.status === "DELIVERED",
      timestamp: order.deliveredAt,
    },
  ];
}

function formatPaymentMethodLabel(provider: OrderConfirmationDTO["paymentProvider"]): string {
  if (provider === "STRIPE") return "Card / Digital Wallet (Stripe)";
  if (provider === "RAZORPAY") return "UPI / Card (Razorpay)";
  return "Card / Express Payment";
}

function formatPaymentStatusLabel(
  status: OrderConfirmationDTO["paymentStatus"],
  paidAt: string | null,
): {
  label: string;
  variant: "default" | "success" | "destructive" | "outline" | "warning" | "primary";
} {
  switch (status) {
    case "SUCCEEDED":
      return { label: "Paid", variant: "success" };
    case "AUTHORIZED":
      return { label: "Authorized", variant: "primary" };
    case "PENDING":
      return { label: "Pending", variant: "warning" };
    case "FAILED":
      return { label: "Failed", variant: "destructive" };
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return { label: "Refunded", variant: "outline" };
    default:
      return paidAt
        ? { label: "Paid", variant: "success" }
        : { label: "Awaiting Payment", variant: "outline" };
  }
}

export function OrderDetailView({ order, guestToken, secondaryAction }: OrderDetailViewProps) {
  const meta = ORDER_STATUS_META[order.status];
  const needsRetry =
    isCancellableBeforeSettlement(order.status) &&
    (!order.reservedUntil || new Date(order.reservedUntil) > new Date());
  const retryHref = `/checkout?order=${encodeURIComponent(order.orderNumber)}${
    guestToken ? `&token=${encodeURIComponent(guestToken)}` : ""
  }`;
  const invoiceHref = `/api/orders/${encodeURIComponent(order.orderNumber)}/invoice${
    guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""
  }`;

  const hasDiscount = Number(order.discountAmount) > 0;
  const hasRefund = Number(order.refundedAmount) > 0;
  const hasDifferentBase = order.currency !== order.baseCurrency;
  const hasDifferentCharged = Boolean(
    order.chargedCurrency && order.chargedAmount && order.chargedCurrency !== order.currency,
  );
  const paymentBadge = formatPaymentStatusLabel(order.paymentStatus, order.paidAt);
  const milestones = buildOrderMilestones(order);
  const addressKey = (a: typeof order.shippingAddress) =>
    [a.fullName, a.line1, a.line2 ?? "", a.city, a.state, a.postalCode, a.country]
      .map((v) => (v ?? "").trim().toLowerCase())
      .join("|");
  const sameAddress = addressKey(order.shippingAddress) === addressKey(order.billingAddress);

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
            <Badge variant={paymentBadge.variant}>Payment: {paymentBadge.label}</Badge>
          </div>
          <h2 className="tabular-nums-price mt-2 text-2xl leading-[1.2] font-semibold tracking-[-0.015em] break-words text-foreground sm:text-3xl">
            Order {order.orderNumber}
          </h2>
          <p className="tabular-nums-price mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Placed {formatDate(order.createdAt)} · {meta.description}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center print:hidden">
          {needsRetry && (
            <Button asChild className="col-span-2 min-h-11 w-full sm:min-h-10 sm:w-auto">
              <Link href={retryHref}>Complete Payment</Link>
            </Button>
          )}
          <div className="col-span-2 sm:contents">
            <ReorderButton orderNumber={order.orderNumber} guestToken={guestToken} />
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 w-full gap-2 sm:min-h-10 sm:w-auto"
          >
            <a href={invoiceHref} download={`invoice-${order.orderNumber}.pdf`}>
              <Download className="size-4 stroke-[1.5]" aria-hidden="true" />
              <span>Invoice</span>
            </a>
          </Button>
          <OpenAtelierChatButton
            contextType="ORDER"
            contextRefId={order.id}
            title={`Order ${order.orderNumber}`}
            label="Get help"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          />
          <ConfirmationPrintButton className="hidden sm:inline-flex sm:min-h-10" />
          {secondaryAction && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="col-span-2 min-h-11 w-full sm:min-h-10 sm:w-auto"
            >
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Milestone Timeline: Placed -> Confirmed -> Shipped -> Delivered */}
      <section
        aria-label="Order fulfillment milestones"
        className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Progress
          </h3>
          {(order.status === "CANCELLED" || order.status === "REFUNDED") && (
            <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
          )}
        </div>
        <RevealStagger as="ol" className="relative mt-4 grid grid-cols-4 gap-2 sm:gap-4">
          {milestones.map((stage, idx) => (
            <li
              key={stage.key}
              className="relative flex min-w-0 flex-col items-center gap-1 text-center sm:items-start sm:gap-2 sm:text-left"
            >
              <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    stage.reached
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface-2 text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {stage.reached ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                    >
                      <path d="M5 13l4 4L19 7" className="ma-check-draw" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold sm:text-sm",
                    stage.reached ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              <span className="tabular-nums-price text-[11px] leading-tight text-muted-foreground sm:text-xs">
                {stage.timestamp
                  ? formatDate(stage.timestamp, "en-US", { month: "short", day: "numeric" })
                  : stage.active
                    ? "In progress"
                    : "Pending"}
              </span>
            </li>
          ))}
        </RevealStagger>
      </section>

      {(order.carrier || order.trackingNumber || order.trackingUrl) && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <PackageCheck
                className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Shipping</h3>
                <p className="tabular-nums-price mt-0.5 text-sm break-words text-muted-foreground">
                  {order.carrier ?? "Insured courier"}
                  {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                </p>
              </div>
            </div>
            {order.trackingUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-11 w-full sm:min-h-10 sm:w-auto print:hidden"
              >
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                  <span>Track Shipment</span>
                  <ExternalLink className="size-4 stroke-[1.5]" aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 space-y-6 lg:col-span-8">
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
              Items
            </h3>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item, itemIndex) => {
                const isSeedImage = item.imageUrlSnapshot?.startsWith("/images/seed/") ?? false;
                const productHref = item.productSlug
                  ? `/products/${encodeURIComponent(item.productSlug)}`
                  : null;
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 py-4 first:pt-2 last:pb-0 sm:items-center sm:gap-4"
                  >
                    <div className="relative size-[72px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-2 sm:size-20">
                      {item.imageUrlSnapshot ? (
                        productHref ? (
                          <Link href={productHref} className="relative block size-full">
                            <Image
                              loading={itemIndex === 0 ? "eager" : "lazy"}
                              src={item.imageUrlSnapshot}
                              alt={item.titleSnapshot}
                              fill
                              sizes="(max-width: 639px) 72px, 80px"
                              className={
                                isSeedImage
                                  ? "object-cover object-center dark:brightness-90"
                                  : "object-cover object-center"
                              }
                            />
                          </Link>
                        ) : (
                          <Image
                            loading={itemIndex === 0 ? "eager" : "lazy"}
                            src={item.imageUrlSnapshot}
                            alt={item.titleSnapshot}
                            fill
                            sizes="(max-width: 639px) 72px, 80px"
                            className={
                              isSeedImage
                                ? "object-cover object-center dark:brightness-90"
                                : "object-cover object-center"
                            }
                          />
                        )
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      {productHref ? (
                        <Link
                          href={productHref}
                          className="line-clamp-2 block text-sm font-semibold break-words text-foreground hover:text-accent-text hover:underline sm:text-base"
                        >
                          {item.titleSnapshot}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 text-sm font-semibold break-words text-foreground sm:text-base">
                          {item.titleSnapshot}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.variantTitleSnapshot} · SKU {item.skuSnapshot}
                      </p>
                      <CustomizedSpecsBadge
                        requestId={item.customizationRequestId}
                        requestNumber={item.customizationRequestNumber}
                        summaryLines={item.customizationSummaryLines}
                      />
                      <p className="tabular-nums-price mt-1 text-xs text-muted-foreground">
                        {formatMoneyExact(
                          item.unitPrice,
                          order.currency,
                          "en-US",
                          order.currencyDecimals,
                        )}{" "}
                        × {item.quantity}
                      </p>
                    </div>
                    <p className="tabular-nums-price shrink-0 text-sm font-semibold text-foreground">
                      {formatMoneyExact(
                        item.lineTotal,
                        order.currency,
                        "en-US",
                        order.currencyDecimals,
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            {order.giftNote && (
              <div className="mt-4 rounded-md border border-border bg-surface-2 p-3.5 text-xs leading-relaxed break-words text-muted-foreground">
                <span className="font-semibold text-foreground">Gift Note: </span>
                {order.giftNote}
              </div>
            )}
          </section>

          <details className="group rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <span>Order history</span>
              <span className="text-sm font-normal text-muted-foreground group-open:hidden">
                Show
              </span>
              <span className="hidden text-sm font-normal text-muted-foreground group-open:inline">
                Hide
              </span>
            </summary>
            <ol className="relative mt-4 space-y-4 border-l border-border pl-5 sm:border-l-0 sm:pl-0">
              {order.events.map((evt) => {
                const evtMeta = ORDER_STATUS_META[evt.toStatus];
                return (
                  <li key={evt.id} className="flex items-start gap-3">
                    {evt.toStatus === "PAID" || evt.toStatus === "DELIVERED" ? (
                      <CheckCircle2
                        className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock
                        className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{evtMeta.label}</p>
                      {evt.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{evt.note}</p>
                      )}
                      <p className="tabular-nums-price mt-0.5 text-xs text-muted-foreground">
                        {formatDate(evt.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </details>
        </div>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
              Payment
            </h3>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {formatPaymentMethodLabel(order.paymentProvider)}
              </span>
              <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
            </div>
            <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums-price font-medium text-foreground">
                  {formatMoneyExact(
                    order.subtotal,
                    order.currency,
                    "en-US",
                    order.currencyDecimals,
                  )}
                </dd>
              </div>
              {hasDiscount && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums-price font-medium text-accent-text">
                    -
                    {formatMoneyExact(
                      order.discountAmount,
                      order.currency,
                      "en-US",
                      order.currencyDecimals,
                    )}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{order.shippingMethodName}</dt>
                <dd className="tabular-nums-price font-medium text-foreground">
                  {Number(order.shippingCost) === 0
                    ? "Complimentary"
                    : formatMoneyExact(
                        order.shippingCost,
                        order.currency,
                        "en-US",
                        order.currencyDecimals,
                      )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums-price font-medium text-foreground">
                  {formatMoneyExact(
                    order.taxAmount,
                    order.currency,
                    "en-US",
                    order.currencyDecimals,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="text-base font-semibold text-foreground">
                  Total ({order.currency})
                </dt>
                <dd className="tabular-nums-price text-xl font-semibold text-foreground">
                  {formatMoneyExact(order.total, order.currency, "en-US", order.currencyDecimals)}
                </dd>
              </div>
              {(hasDifferentBase || hasDifferentCharged) && (
                <div className="space-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
                  {hasDifferentBase && (
                    <p className="tabular-nums-price">
                      Rate snapshot: 1 {order.baseCurrency} ={" "}
                      {Number(order.exchangeRate).toFixed(4)} {order.currency} · Base total{" "}
                      {formatMoneyExact(order.baseTotal, order.baseCurrency, "en-US", 2)}
                    </p>
                  )}
                  {hasDifferentCharged && (
                    <p className="tabular-nums-price">
                      Charged in base currency:{" "}
                      {formatMoneyExact(order.chargedAmount!, order.chargedCurrency, "en-US", 2)}
                    </p>
                  )}
                </div>
              )}
              {hasRefund && (
                <div className="flex justify-between gap-3 border-t border-border pt-2.5 text-xs font-medium text-accent-text">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums-price">
                    -
                    {formatMoneyExact(
                      order.refundedAmount,
                      order.currency,
                      "en-US",
                      order.currencyDecimals,
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Truck className="size-5 shrink-0 stroke-[1.5] text-accent-text" aria-hidden="true" />
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {sameAddress ? "Delivery & Billing" : "Delivery Address"}
              </h3>
            </div>
            <address className="mt-3 space-y-0.5 text-sm leading-relaxed break-words text-muted-foreground not-italic">
              <p className="font-semibold text-foreground">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{formatCountryName(order.shippingAddress.country)}</p>
              <p className="tabular-nums-price pt-1 text-xs">{order.shippingAddress.phone}</p>
            </address>

            {order.signatureRequired && (
              <div
                role="note"
                className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3.5 text-xs leading-relaxed text-muted-foreground"
              >
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                  aria-hidden="true"
                />
                <span>Signature required on delivery.</span>
              </div>
            )}
          </section>

          {!sameAddress && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                Billing Address
              </h3>
              <address className="mt-3 space-y-0.5 text-sm leading-relaxed break-words text-muted-foreground not-italic">
                <p className="font-semibold text-foreground">{order.billingAddress.fullName}</p>
                <p>{order.billingAddress.line1}</p>
                {order.billingAddress.line2 && <p>{order.billingAddress.line2}</p>}
                <p>
                  {order.billingAddress.city}, {order.billingAddress.state}{" "}
                  {order.billingAddress.postalCode}
                </p>
                <p>{formatCountryName(order.billingAddress.country)}</p>
              </address>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
