"use client";

import { formatDate } from "@/lib/dates";
import { LocalDate } from "@/components/shared/LocalDate";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  MessageSquare,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { ChatThreadPanel } from "@/components/shared/ChatThreadPanel";
import { Price } from "@/components/shared/Price";
import {
  PrivateImageLightbox,
  type LightboxImageItem,
} from "@/components/shared/PrivateImageLightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/currency";
import type { ChatCannedReplyDTO } from "@/modules/chat/chat.service";
import {
  adminAcceptCustomizationQuoteAction,
  adminEditCustomizationSelectionsAction,
  adminRejectCustomizationRequestAction,
  adminRequestCustomizationInfoAction,
  adminUpdateCustomizationNoteAction,
} from "@/modules/customization/customization.actions";
import type {
  CustomizationRequestDetailDTO,
  ProductCustomizationSchemaDTO,
} from "@/modules/customization/customization.service";

interface AdminCustomizationDetailClientProps {
  initialDetail: CustomizationRequestDetailDTO;
  productSchema: ProductCustomizationSchemaDTO | null;
  cannedReplies: ChatCannedReplyDTO[];
}

export function AdminCustomizationDetailClient({
  initialDetail,
  productSchema,
  cannedReplies,
}: AdminCustomizationDetailClientProps) {
  const router = useRouter();
  const { currencies } = useCurrency();
  const [detail, setDetail] = React.useState(initialDetail);
  const [internalNote, setInternalNote] = React.useState(initialDetail.internalNote ?? "");
  const [savingNote, setSavingNote] = React.useState(false);

  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const [quotePrice, setQuotePrice] = React.useState(
    initialDetail.quotedPriceBase ?? initialDetail.indicativeMaxBase,
  );
  const [validityDays, setValidityDays] = React.useState("7");
  const [deliveryDays, setDeliveryDays] = React.useState(
    String(productSchema?.minLeadTimeDays ?? 21),
  );
  const [adminMessage, setAdminMessage] = React.useState("");
  const [submittingQuote, setSubmittingQuote] = React.useState(false);

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [submittingReject, setSubmittingReject] = React.useState(false);

  const [moreInfoOpen, setMoreInfoOpen] = React.useState(false);
  const [infoMessage, setInfoMessage] = React.useState("");
  const [submittingInfo, setSubmittingInfo] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editMap, setEditMap] = React.useState<
    Record<
      string,
      {
        value?: string | null;
        values?: string[] | null;
        numberValue?: number | null;
        textValue?: string | null;
        imageCount?: number | null;
      }
    >
  >(() => {
    const out: Record<
      string,
      {
        value?: string | null;
        values?: string[] | null;
        numberValue?: number | null;
        textValue?: string | null;
        imageCount?: number | null;
      }
    > = {};
    for (const sel of initialDetail.selections) {
      out[sel.groupCode] = {
        value:
          sel.groupType === "SELECT" || sel.groupType === "SWATCH"
            ? (sel.valueCodes[0] ?? undefined)
            : undefined,
        values: sel.groupType === "MULTI_SELECT" ? [...sel.valueCodes] : undefined,
        numberValue:
          sel.groupType === "NUMBER_RANGE" && sel.numberValue !== null
            ? Number(sel.numberValue)
            : undefined,
        textValue:
          sel.groupType === "TEXT" || sel.groupType === "TEXTAREA"
            ? (sel.rawText ?? undefined)
            : undefined,
      };
    }
    return out;
  });
  const [savingEdits, setSavingEdits] = React.useState(false);

  const [lightboxIdx, setLightboxIdx] = React.useState<number | null>(null);
  const lightboxImages: LightboxImageItem[] = detail.images.map((img, i) => ({
    url: img.url,
    alt: img.originalName ?? `Reference image ${i + 1}`,
  }));

  const isTerminal = ["ORDERED", "CANCELLED", "REJECTED"].includes(detail.status);

  async function refreshFromServer() {
    const res = await fetch(`/api/customizations/${encodeURIComponent(detail.id)}`);
    const json = (await res.json().catch(() => null)) as {
      request?: CustomizationRequestDetailDTO;
    } | null;
    if (res.ok && json?.request) {
      setDetail(json.request);
      setInternalNote(json.request.internalNote ?? "");
    }
    router.refresh();
  }

  async function handleSaveNote(markInReview?: boolean) {
    setSavingNote(true);
    const res = await adminUpdateCustomizationNoteAction({
      requestId: detail.id,
      internalNote,
      status: markInReview ? "IN_REVIEW" : undefined,
    });
    setSavingNote(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Internal note saved.");
    await refreshFromServer();
  }

  async function handleAcceptQuote() {
    const numeric = Number(quotePrice);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Please enter a valid positive base quote amount.");
      return;
    }
    setSubmittingQuote(true);
    const res = await adminAcceptCustomizationQuoteAction({
      requestId: detail.id,
      quotedPriceBase: numeric,
      validityDays: Number(validityDays) || 7,
      estimatedDeliveryDays: deliveryDays.trim() ? Number(deliveryDays) : null,
      adminMessage: adminMessage.trim() || null,
      internalNote: internalNote.trim() || null,
    });
    setSubmittingQuote(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Quotation accepted & approval email sent to collector.");
    setAcceptOpen(false);
    await refreshFromServer();
  }

  async function handleReject() {
    if (rejectReason.trim().length < 3) {
      toast.error("Please enter a clear reason for the customer.");
      return;
    }
    setSubmittingReject(true);
    const res = await adminRejectCustomizationRequestAction({
      requestId: detail.id,
      rejectionReason: rejectReason.trim(),
      internalNote: internalNote.trim() || null,
    });
    setSubmittingReject(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Request marked rejected and collector notified.");
    setRejectOpen(false);
    await refreshFromServer();
  }

  async function handleMoreInfo() {
    if (infoMessage.trim().length < 3) {
      toast.error("Please enter your question for the collector.");
      return;
    }
    setSubmittingInfo(true);
    const res = await adminRequestCustomizationInfoAction({
      requestId: detail.id,
      message: infoMessage.trim(),
      internalNote: internalNote.trim() || null,
    });
    setSubmittingInfo(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Question posted to chat & emailed to collector.");
    setMoreInfoOpen(false);
    setInfoMessage("");
    await refreshFromServer();
  }

  async function handleSaveEditedSelections() {
    setSavingEdits(true);
    const res = await adminEditCustomizationSelectionsAction({
      requestId: detail.id,
      selections: editMap,
      internalNote: internalNote.trim() || null,
    });
    setSavingEdits(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Custom selections updated.");
    setEditOpen(false);
    await refreshFromServer();
  }

  const parsedPreviewAmount = Number(quotePrice);
  const validPreviewAmount =
    Number.isFinite(parsedPreviewAmount) && parsedPreviewAmount > 0 ? parsedPreviewAmount : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/customizations"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Customization Requests
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-semibold text-foreground">
              {detail.requestNumber}
            </h1>
            <Badge>{detail.status.replace("_", " ")}</Badge>
            {detail.orderNumber ? (
              <Badge variant="outline">Order {detail.orderNumber}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted <LocalDate value={detail.createdAt} withTime /> for{" "}
            <Link
              href={`/products/${detail.productSlug}`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {detail.productName}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isTerminal ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="min-h-10"
              >
                <Edit3 className="mr-1.5 size-4" />
                Edit Selections
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMoreInfoOpen(true)}
                className="min-h-10"
              >
                <MessageSquare className="mr-1.5 size-4" />
                Request Info
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                className="min-h-10"
              >
                <XCircle className="mr-1.5 size-4" />
                Reject
              </Button>
              <Button type="button" onClick={() => setAcceptOpen(true)} className="min-h-10">
                <CheckCircle2 className="mr-1.5 size-4" />
                {detail.status === "ACCEPTED" ? "Re-issue Quote" : "Accept & Quote"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main left column */}
        <div className="space-y-6 lg:col-span-7">
          {/* Customer & Request Summary */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-medium">Customer &amp; request details</h2>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Collector</p>
                <p className="font-medium text-foreground">{detail.customerName}</p>
                <p className="text-xs text-muted-foreground">{detail.customerEmail}</p>
                {detail.customerPhone ? (
                  <p className="text-xs text-muted-foreground">{detail.customerPhone}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contact &amp; Timeline</p>
                <p className="font-medium text-foreground">Preferred: {detail.contactPreference}</p>
                <p className="text-xs text-muted-foreground">
                  Timeline: {detail.preferredTimeline || "Flexible"}
                  {detail.preferredDate
                    ? ` (Target ${formatDate(detail.preferredDate, "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })})`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Indicative Estimate (Base USD)</p>
                <p className="font-medium text-foreground">
                  <Price amount={detail.indicativeMinBase} /> –{" "}
                  <Price amount={detail.indicativeMaxBase} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Locked Quote</p>
                {detail.quotedPriceBase ? (
                  <p className="font-semibold text-foreground">
                    <Price amount={detail.quotedPriceBase} exact />{" "}
                    {detail.quoteExpiresAt ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        (Expires <LocalDate value={detail.quoteExpiresAt} />)
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not yet quoted</p>
                )}
              </div>
              {detail.customerNote ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Collector Note</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                    {detail.customerNote}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Selections */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-medium">Selected Specifications</h2>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {detail.selections.map((sel) => (
                  <div
                    key={sel.groupCode}
                    className="rounded-lg border border-border bg-background/60 px-3.5 py-2.5"
                  >
                    <dt className="text-xs text-muted-foreground">{sel.groupLabel}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {sel.displayValue || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Reference Images */}
          {detail.images.length > 0 ? (
            <Card>
              <CardHeader>
                <h2 className="font-display text-lg font-medium">
                  Reference Inspiration Images ({detail.images.length})
                </h2>
                <CardDescription>Click any image to inspect full resolution.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {detail.images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.thumbUrl || img.url}
                      alt={img.originalName ?? `Reference ${i + 1}`}
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Private Internal Notes */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-medium">Internal notes (private)</h2>
              <CardDescription>
                Never shared with customers; visible strictly to staff and admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={3}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Sourcing notes, stone vendor availability, goldsmith allocation…"
                aria-label="Private internal note"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={savingNote}
                  onClick={() => void handleSaveNote(false)}
                >
                  <Save className="mr-1.5 size-3.5" />
                  Save Private Note
                </Button>
                {detail.status === "SUBMITTED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingNote}
                    onClick={() => void handleSaveNote(true)}
                  >
                    Move to In Review
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Activity log */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-medium">Activity Timeline</h2>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {detail.events.map((evt) => (
                  <li
                    key={evt.id}
                    className="flex items-start justify-between gap-4 border-l-2 border-border pl-3.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {evt.eventType.replace(/_/g, " ")} ·{" "}
                        <span className="text-muted-foreground">{evt.toStatus}</span>
                      </p>
                      {evt.message ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{evt.message}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <LocalDate value={evt.createdAt} withTime />
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Attached Chat Thread Side Panel */}
        <div className="lg:col-span-5">
          <Card className="sticky top-20 flex h-[640px] flex-col overflow-hidden">
            <CardHeader className="border-b border-border py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent-text" aria-hidden="true" />
                <h2 className="font-display text-base font-medium">Collector Thread</h2>
              </div>
              <CardDescription className="text-xs">
                Real-time chat synced to collector account &amp; request portal.
              </CardDescription>
            </CardHeader>
            <div className="min-h-0 flex-1">
              {detail.conversationId ? (
                <ChatThreadPanel
                  conversationId={detail.conversationId}
                  viewerRole="ADMIN"
                  cannedReplies={cannedReplies}
                  composerPlaceholder="Message the customer about this request…"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  Use &ldquo;Request Info&rdquo; to open a chat thread with this collector.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Accept & Quote Dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send quote</DialogTitle>
            <DialogDescription>
              Sets a server-locked price, sends a single-use approval link to {detail.customerEmail}
              , and enables direct bag checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="quote-price-base" className="mb-1 block text-xs font-medium">
                Final Price (Base USD)
              </label>
              <Input
                id="quote-price-base"
                type="number"
                min="1"
                step="0.01"
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
              />
              {validPreviewAmount > 0 ? (
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Live Multi-Currency Previews
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-foreground">
                    {currencies.map((curr) => (
                      <span
                        key={curr.code}
                        className="rounded border border-border bg-background px-2 py-0.5"
                      >
                        {curr.code}:{" "}
                        {formatPrice(validPreviewAmount.toFixed(2), curr, { exact: true })}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quote-validity" className="mb-1 block text-xs font-medium">
                  Validity (Days)
                </label>
                <Input
                  id="quote-validity"
                  type="number"
                  min={1}
                  max={90}
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="quote-delivery" className="mb-1 block text-xs font-medium">
                  Est. Crafting Days
                </label>
                <Input
                  id="quote-delivery"
                  type="number"
                  min={1}
                  max={365}
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="quote-message" className="mb-1 block text-xs font-medium">
                Personal Note to Collector (Included in Email)
              </label>
              <Textarea
                id="quote-message"
                rows={3}
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="We sourced an ideal GIA D-VVS1 oval stone matching your brief…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAcceptOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submittingQuote} onClick={handleAcceptQuote}>
              {submittingQuote ? "Issuing Quote…" : "Confirm & Email Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Customization Request</DialogTitle>
            <DialogDescription>
              Provide a gracious explanation emailed to {detail.customerEmail}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (e.g., setting structural constraints with requested dimensions…)"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submittingReject}
              onClick={handleReject}
            >
              {submittingReject ? "Rejecting…" : "Decline & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request More Info Dialog */}
      <Dialog open={moreInfoOpen} onOpenChange={setMoreInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Additional Clarification</DialogTitle>
            <DialogDescription>
              Posts directly into the attached collector chat and sends an email notification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={infoMessage}
            onChange={(e) => setInfoMessage(e.target.value)}
            placeholder="Ask about preferred ring sizing standard, diamond fluorescence preference, etc."
            aria-label="Clarification message"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoreInfoOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submittingInfo} onClick={handleMoreInfo}>
              {submittingInfo ? "Sending…" : "Send in Chat & Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Selections Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit request details</DialogTitle>
            <DialogDescription>
              Refine specifications agreed with the collector before quoting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(productSchema?.groups ?? [])
              .filter((g) => g.type !== "IMAGE_UPLOAD")
              .map((group) => {
                const cur = editMap[group.code] ?? {};
                return (
                  <div key={group.code}>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {group.label}
                    </label>
                    {group.type === "SELECT" || group.type === "SWATCH" ? (
                      <NativeSelect
                        value={cur.value ?? ""}
                        onChange={(e) =>
                          setEditMap((prev) => ({
                            ...prev,
                            [group.code]: { value: e.target.value },
                          }))
                        }
                      >
                        <option value="">— Select —</option>
                        {group.values.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : group.type === "MULTI_SELECT" ? (
                      <div className="flex flex-wrap gap-2">
                        {group.values.map((v) => {
                          const selectedArr = cur.values ?? [];
                          const checked = selectedArr.includes(v.value);
                          return (
                            <label
                              key={v.value}
                              className="flex cursor-pointer items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selectedArr, v.value]
                                    : selectedArr.filter((x) => x !== v.value);
                                  setEditMap((prev) => ({
                                    ...prev,
                                    [group.code]: { values: next },
                                  }));
                                }}
                              />
                              {v.label}
                            </label>
                          );
                        })}
                      </div>
                    ) : group.type === "NUMBER_RANGE" ? (
                      <Input
                        type="number"
                        step={group.stepValue ?? "0.1"}
                        value={cur.numberValue ?? ""}
                        onChange={(e) =>
                          setEditMap((prev) => ({
                            ...prev,
                            [group.code]: {
                              numberValue: e.target.value ? Number(e.target.value) : null,
                            },
                          }))
                        }
                      />
                    ) : (
                      <Input
                        value={cur.textValue ?? ""}
                        onChange={(e) =>
                          setEditMap((prev) => ({
                            ...prev,
                            [group.code]: { textValue: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={savingEdits} onClick={handleSaveEditedSelections}>
              {savingEdits ? "Saving…" : "Save Updated Specs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrivateImageLightbox
        images={lightboxImages}
        activeIndex={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onChangeIndex={setLightboxIdx}
      />
    </div>
  );
}
