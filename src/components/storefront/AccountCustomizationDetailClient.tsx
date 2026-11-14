"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CopyPlus,
  Edit3,
  Loader2,
  MessagesSquare,
  Phone,
  ShoppingBag,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useUserCustomizationsRealtime } from "@/components/providers/useChatRealtime";
import { ChatThreadPanel } from "@/components/shared/ChatThreadPanel";
import {
  PrivateImageLightbox,
  type LightboxImageItem,
} from "@/components/shared/PrivateImageLightbox";
import { CustomizationFormClient } from "@/components/storefront/CustomizationFormClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CUSTOMIZATION_SWATCH_FALLBACK } from "@/lib/customization-swatches";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  acceptCustomizationQuoteToBagAction,
  cancelCustomizationRequestAction,
  duplicateCustomizationRequestAction,
} from "@/modules/customization/customization.actions";
import type {
  CustomizationRequestDetailDTO,
  ProductCustomizationSchemaDTO,
} from "@/modules/customization/customization.service";
import { visitorStore } from "@/modules/storefront/visitor-store";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

interface AccountCustomizationDetailClientProps {
  initialDetail: CustomizationRequestDetailDTO;
  productSchema: ProductCustomizationSchemaDTO | null;
  ownerKey: string;
}

// Labels come from site-content.json → ui.account.customizationStatus / customizationDetail.
const TIMELINE_STEPS = ["SUBMITTED", "IN_REVIEW", "ACCEPTED", "ORDERED"] as const;

type BadgeVariant = "default" | "primary" | "success" | "warning" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SUBMITTED: "outline",
  IN_REVIEW: "warning",
  ACCEPTED: "primary",
  ORDERED: "success",
  REJECTED: "destructive",
  CANCELLED: "outline",
  EXPIRED: "outline",
};

function getBadgeMeta(
  status: string,
  labels: Record<string, string>,
  detailLabels: { acceptedBadge: string; expiredBadge: string },
): { label: string; variant: BadgeVariant } {
  const label =
    status === "ACCEPTED"
      ? detailLabels.acceptedBadge
      : status === "EXPIRED"
        ? detailLabels.expiredBadge
        : (labels[status] ?? status);
  return { label, variant: STATUS_VARIANTS[status] ?? "outline" };
}

/**
 * Customer detail view for a single bespoke customization request:
 * status timeline, specifications, reference images, quotation acceptance,
 * inline edit drawer while SUBMITTED, cancel, reorder, and embedded live chat.
 */
export function AccountCustomizationDetailClient({
  initialDetail,
  productSchema,
  ownerKey,
}: AccountCustomizationDetailClientProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const ui = useUiText().account;
  const t = ui.customizationDetail;
  const statusLabels = ui.customizationStatus as Record<string, string>;
  const [detail, setDetail] = React.useState(initialDetail);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<
    "accept" | "cancel" | "duplicate" | "chat" | null
  >(null);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [conversationId, setConversationId] = React.useState<string | null>(
    initialDetail.conversationId,
  );
  const [renderedAtMs] = React.useState(() => Date.now());

  const refreshDetail = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/customizations/${encodeURIComponent(detail.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        data?: CustomizationRequestDetailDTO;
      };
      if (body.ok && body.data) {
        setDetail(body.data);
        if (body.data.conversationId) {
          setConversationId(body.data.conversationId);
        }
      }
    } catch {
      // Silent refresh
    }
  }, [detail.id]);

  useUserCustomizationsRealtime({
    targetKey: ownerKey,
    enabled: Boolean(ownerKey),
    onCustomizationEvent: () => {
      void refreshDetail();
    },
  });

  const statusMeta = getBadgeMeta(detail.status, statusLabels, t);
  const isQuoteExpired =
    detail.status === "EXPIRED" ||
    (detail.status === "ACCEPTED" &&
      Boolean(detail.quoteExpiresAt) &&
      new Date(detail.quoteExpiresAt!).getTime() <= renderedAtMs);
  const canEdit = detail.status === "SUBMITTED" && Boolean(productSchema);
  const canCancel =
    detail.status === "SUBMITTED" || detail.status === "IN_REVIEW" || detail.status === "ACCEPTED";
  const canAcceptToBag = detail.status === "ACCEPTED" && !isQuoteExpired;

  const lightboxImages: LightboxImageItem[] = detail.images.map((img, i) => ({
    url: img.url,
    thumbUrl: img.thumbUrl,
    alt: img.originalName ?? fill(t.imageAlt, { n: i + 1 }),
  }));

  async function handleAcceptToBag() {
    setBusyAction("accept");
    const res = await acceptCustomizationQuoteToBagAction({ requestId: detail.id });
    setBusyAction(null);
    if (!res.ok) {
      notifyError(res.error.message);
      return;
    }
    visitorStore.setLatestCart(res.data);
    notifySuccess(t.acceptedToast);
    router.push("/checkout");
  }

  async function handleCancel() {
    setBusyAction("cancel");
    const res = await cancelCustomizationRequestAction({
      requestId: detail.id,
      reason: "Cancelled by customer from account.",
    });
    setBusyAction(null);
    if (!res.ok) {
      notifyError(res.error.message);
      return;
    }
    setDetail(res.data);
    setConfirmCancel(false);
    notifySuccess(t.cancelledToast);
  }

  async function handleDuplicate() {
    setBusyAction("duplicate");
    const res = await duplicateCustomizationRequestAction({ requestId: detail.id });
    setBusyAction(null);
    if (!res.ok) {
      notifyError(res.error.message);
      return;
    }
    notifySuccess(fill(t.duplicatedToast, { number: res.data.requestNumber }));
    router.push(`/account/customizations/${encodeURIComponent(res.data.id)}`);
  }

  async function handleStartChatThread() {
    setBusyAction("chat");
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextType: "CUSTOMIZATION_REQUEST",
          contextRefId: detail.id,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        data?: { conversation?: { id: string } };
        error?: { message?: string };
      };
      if (!res.ok || !body.ok || !body.data?.conversation?.id) {
        throw new Error(body.error?.message ?? t.chatError);
      }
      setConversationId(body.data.conversation.id);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t.chatError);
    } finally {
      setBusyAction(null);
    }
  }

  const reachedIndex = (() => {
    if (detail.status === "SUBMITTED") return 0;
    if (detail.status === "IN_REVIEW") return 1;
    if (detail.status === "ACCEPTED") return 2;
    if (detail.status === "ORDERED") return 3;
    return detail.quotedPriceBase ? 2 : 1;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account/customizations"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{t.back}</span>
        </Link>

        {detail.orderNumber ? (
          <Button asChild variant="outline" size="sm" className="min-h-10">
            <Link href={`/account/orders/${encodeURIComponent(detail.orderNumber)}`}>
              {t.viewOrder} {detail.orderNumber}
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Header Card */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {detail.productImageUrl ? (
                <Image
                  src={detail.productImageUrl}
                  alt={detail.productName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums-price text-xs font-semibold tracking-wider text-accent-text uppercase">
                  {detail.requestNumber}
                </span>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
              <h2 className="mt-1 font-serif text-2xl font-medium text-foreground">
                <Link href={`/products/${detail.productSlug}`} className="hover:underline">
                  {detail.productName}
                </Link>
              </h2>
              <p className="tabular-nums-price text-xs text-muted-foreground">
                {t.submitted} {formatDate(detail.createdAt)} · {t.sku} {detail.productSku}
              </p>
            </div>
          </div>

          {/* Primary Lifecycle Actions */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {canAcceptToBag ? (
              <Button
                type="button"
                size="lg"
                disabled={busyAction !== null}
                onClick={() => void handleAcceptToBag()}
                className="min-h-11 w-full gap-2 sm:w-auto"
              >
                {busyAction === "accept" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShoppingBag className="size-4" aria-hidden="true" />
                )}
                <span>{t.acceptQuote}</span>
              </Button>
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="min-h-11 gap-1.5"
              >
                <Edit3 className="size-4" aria-hidden="true" />
                <span>{t.edit}</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyAction !== null}
              onClick={() => void handleDuplicate()}
              className="min-h-11 gap-1.5"
            >
              <CopyPlus className="size-4" aria-hidden="true" />
              <span>{t.duplicate}</span>
            </Button>

            {canCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyAction !== null}
                onClick={() => setConfirmCancel((v) => !v)}
                className="min-h-11 text-destructive hover:text-destructive"
              >
                {" "}
                {t.cancel}{" "}
              </Button>
            ) : null}
          </div>
        </div>

        {confirmCancel ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3.5 text-sm">
            <p className="text-foreground"> {t.cancelConfirmText} </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmCancel(false)}
              >
                {" "}
                {t.keep}{" "}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busyAction === "cancel"}
                onClick={() => void handleCancel()}
              >
                {busyAction === "cancel" ? t.cancelling : t.confirmCancel}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Status Progression Bar */}
        <div className="mt-6 border-t border-border pt-5">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIMELINE_STEPS.map((step, idx) => {
              const reached = idx <= reachedIndex;
              return (
                <li
                  key={step}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                    reached
                      ? "border-accent/45 bg-surface-2 text-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {reached ? (
                    <CheckCircle2 className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
                  ) : (
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{statusLabels[step]}</span>
                </li>
              );
            })}
          </ol>

          {detail.status === "REJECTED" && detail.rejectionReason ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-foreground">
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t.rejectionHeading}</p>
                <p className="text-muted-foreground">{detail.rejectionReason}</p>
              </div>
            </div>
          ) : null}

          {isQuoteExpired ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-warning/45 bg-warning/10 p-3.5 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t.expiredHeading}</p>
                <p className="text-muted-foreground"> {t.expiredText} </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Quotation, Specs, Images, Events */}
        <div className="space-y-6 lg:col-span-6">
          {/* Quotation Summary */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              {" "}
              {t.quoteHeading}{" "}
            </h3>
            {detail.quotedPriceBase ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{t.lockedQuote}</span>
                  <span className="tabular-nums-price text-2xl font-semibold text-foreground">
                    {formatPrice(detail.quotedPriceBase)}
                  </span>
                </div>
                <p className="tabular-nums-price text-xs text-muted-foreground">
                  {t.baseAmount} {formatMoneyExact(detail.quotedPriceBase, "USD", "en-US", 2)}
                  {detail.quoteExpiresAt
                    ? ` · ${fill(t.validUntil, { date: formatDate(detail.quoteExpiresAt) })}`
                    : ""}
                  {detail.estimatedDeliveryDays
                    ? ` · ${fill(t.deliveryEstimate, { days: detail.estimatedDeliveryDays })}`
                    : ""}
                </p>
                {detail.adminMessage ? (
                  <p className="rounded-md border border-border bg-surface-2 p-3 text-sm leading-relaxed text-foreground">
                    {detail.adminMessage}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{t.indicativeRange}</span>
                  <span className="tabular-nums-price text-lg font-semibold text-foreground">
                    {formatPrice(detail.indicativeMinBase)} –{" "}
                    {formatPrice(detail.indicativeMaxBase)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground"> {t.indicativeText} </p>
              </div>
            )}
          </section>

          {/* Specifications List */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              {" "}
              {t.specsHeading}{" "}
            </h3>
            <dl className="mt-3 divide-y divide-border text-sm">
              {detail.selections.map((sel) => (
                <div key={sel.groupCode} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{sel.groupLabel}</dt>
                  <dd className="flex max-w-[60%] items-center justify-end gap-2 text-right font-medium text-foreground">
                    {sel.swatchHex ? (
                      <span
                        className="size-3.5 shrink-0 rounded-full border border-border"
                        style={{
                          backgroundColor: sel.swatchHex || CUSTOMIZATION_SWATCH_FALLBACK,
                        }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="break-words">{sel.displayValue}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden="true" />
                <span>Contact: {detail.contactPreference}</span>
              </div>
              {detail.preferredTimeline || detail.preferredDate ? (
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" aria-hidden="true" />
                  <span>
                    {detail.preferredTimeline || ""}{" "}
                    {detail.preferredDate ? `(${formatDate(detail.preferredDate)})` : ""}
                  </span>
                </div>
              ) : null}
            </div>
            {detail.customerNote ? (
              <p className="mt-3 rounded-md border border-border bg-surface-2 p-3 text-sm text-foreground">
                {detail.customerNote}
              </p>
            ) : null}
          </section>

          {/* Reference Images */}
          {detail.images.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {" "}
                {fill(t.imagesHeading, { count: detail.images.length })}{" "}
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {detail.images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={fill(t.inspectAria, {
                      name: img.originalName ?? fill(t.imageName, { n: idx + 1 }),
                    })}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Image
                      src={img.thumbUrl}
                      alt={img.originalName ?? fill(t.thumbAlt, { n: idx + 1 })}
                      fill
                      unoptimized
                      sizes="120px"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* Activity History */}
          {detail.events.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {" "}
                {t.historyHeading}{" "}
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs">
                {detail.events.map((ev) => (
                  <li key={ev.id} className="border-l-2 border-border pl-3">
                    <p className="font-medium text-foreground">
                      {ev.message || `${ev.eventType} (${ev.toStatus})`}
                    </p>
                    <p className="tabular-nums-price text-muted-foreground">
                      {formatDate(ev.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Right: Attached Atelier Chat Thread */}
        <section className="lg:col-span-6">
          <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <MessagesSquare className="size-4 text-accent-text" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">{t.chatHeading}</h3>
              </div>
              <Badge variant="outline">{detail.requestNumber}</Badge>
            </div>

            {conversationId ? (
              <div className="min-h-0 flex-1">
                <ChatThreadPanel
                  conversationId={conversationId}
                  viewerRole="CUSTOMER"
                  composerPlaceholder={fill(t.chatPlaceholder, { number: detail.requestNumber })}
                  suggestedPrompts={t.chatSuggestions}
                  className="h-full"
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <MessagesSquare
                  className="size-8 stroke-[1.5] text-accent-text"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  {fill(t.chatStartText, { number: detail.requestNumber })}
                </p>
                <Button
                  type="button"
                  disabled={busyAction === "chat"}
                  onClick={() => void handleStartChatThread()}
                >
                  {busyAction === "chat" ? t.chatStarting : t.chatOpen}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Edit Modal while SUBMITTED */}
      {canEdit && productSchema ? (
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent
            data-customize-drawer={editOpen ? "true" : "false"}
            side="right"
            transformOnly250
            enableHorizontalDrag={false}
            overlayClassName="bg-overlay backdrop-blur-[1.5px]"
            className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-0 bg-card p-0 pb-0 shadow-2xl sm:w-[480px] sm:max-w-[92vw] sm:rounded-l-2xl sm:rounded-r-none sm:border-y-0 sm:border-r-0 sm:border-l sm:border-border sm:p-0 lg:w-[520px] lg:max-w-[92vw]"
          >
            <SheetHeader className="border-b border-border px-5 py-4 sm:px-6">
              <SheetTitle className="font-sans text-lg font-semibold">
                {fill(t.editTitle, { number: detail.requestNumber })}
              </SheetTitle>
              <SheetDescription> {t.editText} </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CustomizationFormClient
                schema={productSchema}
                initialRequest={detail}
                mode="edit"
                variant="drawer"
                hideHeader
                onSuccess={(updated) => {
                  setDetail(updated);
                  setEditOpen(false);
                }}
                onCancel={() => setEditOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {lightboxIndex !== null && lightboxImages.length > 0 ? (
        <PrivateImageLightbox
          images={lightboxImages}
          activeIndex={lightboxIndex}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}
