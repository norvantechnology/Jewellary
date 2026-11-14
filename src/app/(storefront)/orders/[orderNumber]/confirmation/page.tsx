import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import { RevealStagger } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CustomizedSpecsBadge } from "@/components/shared/CustomizedSpecsBadge";
import { Container, Section } from "@/components/shared/primitives";
import { ConfirmationPrintButton } from "@/components/storefront/ConfirmationPrintButton";
import { CopyOrderNumberButton } from "@/components/storefront/CopyOrderNumberButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { getOrderConfirmation, type OrderConfirmationDTO } from "@/modules/orders/order.service";
import {
  getOrderStatusMeta,
  isCancellableBeforeSettlement,
  type OrderStatusTexts,
} from "@/modules/orders/state-machine";
import { getOptionalSession } from "@/server/dal";
import { AppError } from "@/server/errors";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.confirmation.seo, {
    pathname: "/orders",
    canonical: "/orders",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function ConfirmationBody({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ orderNumber }, { token }, siteContent] = await Promise.all([
    params,
    searchParams,
    getSiteContent(),
  ]);
  const page = siteContent.pages.confirmation;
  const missing = page.unavailable;

  const normalizedOrderNumber = decodeURIComponent(orderNumber).trim().toUpperCase();
  let order: OrderConfirmationDTO | null = null;
  let errorMessage: string | null = null;

  const session = await getOptionalSession();
  try {
    order = await getOrderConfirmation(normalizedOrderNumber, token ?? null);
  } catch (err) {
    errorMessage = err instanceof AppError ? err.message : missing.loadError;
  }

  if (!order) {
    return (
      <Section spacing="md" className="pt-4 pb-10 sm:pt-6 sm:pb-16 md:pt-6 lg:pt-8 lg:pb-24">
        <Container className="max-w-2xl">
          <div className="rounded-xl border border-border bg-card p-5 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text">
              <ShieldAlert className="size-5 stroke-[1.5]" aria-hidden="true" />
            </div>
            <h1 className="type-h2 mt-4 font-semibold text-foreground">
              {session ? missing.wrongAccountHeading : missing.signedOutHeading}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground sm:text-sm">
              {session
                ? missing.wrongAccountText.replace("{email}", session.user.email)
                : (errorMessage ?? missing.signedOutText)}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
              {session ? (
                <Button asChild className="w-full min-[480px]:w-auto">
                  <Link href="/account/orders">{missing.viewOrders}</Link>
                </Button>
              ) : (
                <Button asChild className="w-full min-[480px]:w-auto">
                  <Link
                    href={`/login?next=${encodeURIComponent(`/orders/${encodeURIComponent(normalizedOrderNumber)}/confirmation`)}`}
                  >
                    {missing.signIn}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full min-[480px]:w-auto">
                <Link href="/orders/track">{missing.trackOrder}</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full min-[480px]:w-auto">
                <Link href="/contact?type=GENERAL">{missing.contact}</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  // Status names come from site-content.json → ui.orders.statuses (admin-editable).
  const statusMeta = getOrderStatusMeta(siteContent.ui.orders.statuses as OrderStatusTexts);
  const meta = statusMeta[order.status];
  const needsRetry =
    isCancellableBeforeSettlement(order.status) &&
    (!order.reservedUntil || new Date(order.reservedUntil) > new Date());
  const retryHref = `/checkout?order=${encodeURIComponent(order.orderNumber)}${
    token ? `&token=${encodeURIComponent(token)}` : ""
  }`;

  return (
    <Section spacing="md" className="pt-4 pb-10 sm:pt-6 sm:pb-16 md:pt-6 lg:pt-8 lg:pb-24">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: `${page.orderLabel} ${order.orderNumber}` },
          ]}
        />

        <div className="mt-3 flex flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:gap-3.5">
            {order.status === "PAID" ||
            order.status === "PROCESSING" ||
            order.status === "SHIPPED" ||
            order.status === "DELIVERED" ? (
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success sm:mt-1 sm:size-10"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                >
                  <path d="M5 13l4 4L19 7" className="ma-check-draw" />
                </svg>
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h1 className="tabular-nums-price text-2xl leading-tight font-semibold break-words text-foreground sm:text-4xl">
                  <span className="block text-base font-medium text-muted-foreground sm:inline sm:text-4xl sm:font-semibold sm:text-foreground">
                    {page.orderLabel}{" "}
                  </span>
                  {order.orderNumber}
                </h1>
                <CopyOrderNumberButton orderNumber={order.orderNumber} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {meta.description}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center print:hidden">
            {needsRetry && (
              <Button asChild className="col-span-2 w-full sm:w-auto">
                <Link href={retryHref}>{page.completePayment}</Link>
              </Button>
            )}
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href={`/orders/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}>
                {page.trackOrder}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/collections">{page.keepShopping}</Link>
            </Button>
            <ConfirmationPrintButton className="hidden sm:inline-flex" />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            {/* Items Snapshot */}
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
                {page.itemsHeading}
              </h2>
              <ul className="mt-4 divide-y divide-border">
                {order.items.map((item) => {
                  const isSeedImage = item.imageUrlSnapshot?.startsWith("/images/seed/") ?? false;
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 py-4 first:pt-2 last:pb-0 sm:items-center sm:gap-4"
                    >
                      <div className="relative size-[72px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-2 sm:size-20">
                        {item.imageUrlSnapshot ? (
                          <Image
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
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold break-words text-foreground sm:text-base">
                          {item.titleSnapshot}
                        </p>
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
            </section>

            {/* Timeline */}
            <details
              className="group rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
              open={order.events.length <= 2}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <h2>{page.historyHeading}</h2>
                <span className="text-sm font-normal text-muted-foreground group-open:hidden">
                  {page.showLabel}
                </span>
                <span className="hidden text-sm font-normal text-muted-foreground group-open:inline">
                  {page.hideLabel}
                </span>
              </summary>
              <RevealStagger
                as="ol"
                className="relative mt-4 space-y-4 border-l border-border pl-5 sm:border-l-0 sm:pl-0"
              >
                {order.events.map((evt) => {
                  const evtMeta = statusMeta[evt.toStatus];
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
              </RevealStagger>
            </details>
          </div>

          <aside className="min-w-0 space-y-6 lg:col-span-4">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                {page.paymentHeading}
              </h2>
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{page.subtotalLabel}</dt>
                  <dd className="tabular-nums-price font-medium text-foreground">
                    {formatMoneyExact(
                      order.subtotal,
                      order.currency,
                      "en-US",
                      order.currencyDecimals,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{order.shippingMethodName}</dt>
                  <dd className="tabular-nums-price font-medium text-foreground">
                    {Number(order.shippingCost) === 0
                      ? page.freeShippingLabel
                      : formatMoneyExact(
                          order.shippingCost,
                          order.currency,
                          "en-US",
                          order.currencyDecimals,
                        )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{page.taxLabel}</dt>
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
                  <dt className="text-base font-semibold text-foreground">{page.totalLabel}</dt>
                  <dd className="tabular-nums-price text-xl font-semibold text-foreground">
                    {formatMoneyExact(order.total, order.currency, "en-US", order.currencyDecimals)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Truck
                  className="size-5 shrink-0 stroke-[1.5] text-accent-text"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                  {page.deliveryHeading}
                </h2>
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
                  <span>{page.signatureNote}</span>
                </div>
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
        <Section spacing="md" className="pt-4 pb-10 sm:pt-6 sm:pb-16 md:pt-6 lg:pt-8 lg:pb-24">
          <Container>
            <Skeleton className="h-4 w-48" />
            <div className="mt-4 mb-8 space-y-3 border-b border-border pb-6">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
              </div>
              <div className="space-y-6 lg:col-span-4">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <ConfirmationBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
