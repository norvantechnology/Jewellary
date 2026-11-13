"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Check, CheckCheck, Clock, Package, Sparkles } from "lucide-react";
import { formatMoneyExact } from "@/lib/money";
import type { LocalClientChatMessage } from "@/lib/chat-client-cache";
import type { ChatAttachmentDTO } from "@/modules/chat/chat.service";

export interface ChatMessageRowProps {
  message: LocalClientChatMessage;
  isOwn: boolean;
  showSenderName: boolean;
  showGroupFooter: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  viewerRole: "CUSTOMER" | "ADMIN";
  formatPrice: (usdAmount: number | string) => string;
  onOpenLightbox: (attachments: ChatAttachmentDTO[], index: number) => void;
  onRetryFailed?: (message: LocalClientChatMessage) => void;
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  isOwn,
  showSenderName,
  showGroupFooter,
  isGroupStart,
  isGroupEnd,
  viewerRole,
  formatPrice,
  onOpenLightbox,
  onRetryFailed,
}: ChatMessageRowProps) {
  if (message.type === "SYSTEM") {
    return <div className="py-1.5 text-center text-xs text-text-muted">{message.body}</div>;
  }

  const isCardOnly =
    !message.body && (Boolean(message.refSnapshot) || message.attachments.length > 0);
  const bubbleRadiusClass = isOwn
    ? isGroupEnd
      ? "rounded-2xl rounded-br-[4px]"
      : "rounded-2xl"
    : isGroupEnd
      ? "rounded-2xl rounded-bl-[4px]"
      : "rounded-2xl";

  return (
    <div
      className={`chat-msg-item flex min-w-0 flex-col ${
        isOwn ? "items-end" : "items-start"
      } ${isGroupStart ? "mt-3" : "mt-1"}`}
    >
      {showSenderName && !isOwn ? (
        <span className="mb-1 ml-1 text-[11px] font-medium text-text-muted">
          {message.senderName}
        </span>
      ) : null}

      <div
        className={`max-w-[82%] min-w-0 overflow-hidden ${bubbleRadiusClass} ${
          isCardOnly ? "p-2" : "px-3.5 py-2.5"
        } ${
          isOwn
            ? "bg-primary text-on-primary shadow-2xs dark:border dark:border-accent/35 dark:bg-accent-tint dark:text-text"
            : "border border-border bg-surface-2 text-text shadow-2xs"
        }`}
      >
        {message.body ? (
          <p className="text-[15px] leading-[1.45] break-words whitespace-pre-wrap">
            {message.body}
          </p>
        ) : null}

        {/* Attachments */}
        {message.attachments.length > 0 ? (
          <div
            className={`grid gap-1.5 ${message.body ? "mt-2" : ""} ${
              message.attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {message.attachments.map((att, attIdx) => (
              <button
                key={`${att.storageKey}-${attIdx}`}
                type="button"
                onClick={() => onOpenLightbox(message.attachments, attIdx)}
                className="group relative max-h-[240px] max-w-[240px] overflow-hidden rounded-xl border border-border/50 bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.thumbUrl || att.url}
                  alt={att.originalName ?? "Shared photo"}
                  loading="lazy"
                  decoding="async"
                  className="max-h-[240px] w-full max-w-[240px] object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        ) : null}

        {/* Compact product snapshot card */}
        {message.refSnapshot?.kind === "PRODUCT" ? (
          <Link
            href={`/products/${message.refSnapshot.slug}`}
            className={`${message.body || message.attachments.length > 0 ? "mt-2" : ""} flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface p-2 text-left text-text transition-colors hover:border-accent`}
          >
            {message.refSnapshot.thumbUrl || message.refSnapshot.imageUrl ? (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <Image
                  src={message.refSnapshot.thumbUrl || message.refSnapshot.imageUrl || ""}
                  alt={message.refSnapshot.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-text">
                {message.refSnapshot.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {message.refSnapshot.category} ·{" "}
                {message.refSnapshot.priceMode === "PRICE_ON_REQUEST"
                  ? "Price on request"
                  : formatPrice(message.refSnapshot.basePrice)}
              </p>
            </div>
          </Link>
        ) : null}

        {message.refSnapshot?.kind === "REQUEST" ? (
          <Link
            href={
              viewerRole === "ADMIN"
                ? `/admin/customizations/${message.refSnapshot.requestId}`
                : `/account/customizations/${message.refSnapshot.requestId}`
            }
            className={`${message.body || message.attachments.length > 0 ? "mt-2" : ""} flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface p-2 text-left text-text transition-colors hover:border-accent`}
          >
            <Sparkles className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-text">
                {message.refSnapshot.requestNumber} · {message.refSnapshot.productName}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {message.refSnapshot.status}
                {message.refSnapshot.quotedPriceBase
                  ? ` · Quote ${formatPrice(message.refSnapshot.quotedPriceBase)}`
                  : ""}
              </p>
            </div>
          </Link>
        ) : null}

        {message.refSnapshot?.kind === "ORDER" ? (
          <Link
            href={
              viewerRole === "ADMIN"
                ? `/admin/orders`
                : `/account/orders/${encodeURIComponent(message.refSnapshot.orderNumber)}`
            }
            className={`${message.body || message.attachments.length > 0 ? "mt-2" : ""} flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface p-2 text-left text-text transition-colors hover:border-accent`}
          >
            <Package className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-snug font-semibold text-text">
                Order {message.refSnapshot.orderNumber}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {message.refSnapshot.status} ·{" "}
                {formatMoneyExact(message.refSnapshot.total, message.refSnapshot.currency)}
              </p>
            </div>
          </Link>
        ) : null}
      </div>

      {/* Single under-group timestamp + delivery status */}
      {showGroupFooter || message.localStatus === "failed" || message.localStatus === "sending" ? (
        <div
          className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-text-muted ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          {message.localStatus === "failed" ? (
            <button
              type="button"
              onClick={() => onRetryFailed?.(message)}
              className="inline-flex items-center gap-1 font-medium text-danger hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              <span>Failed · Tap to retry</span>
            </button>
          ) : (
            <>
              <span>{formatMessageTime(message.createdAt)}</span>
              {isOwn ? (
                message.localStatus === "sending" ? (
                  <Clock className="size-3 shrink-0" aria-label="Sending" />
                ) : message.readAt ? (
                  <CheckCheck className="size-3.5 shrink-0 text-accent-text" aria-label="Read" />
                ) : (
                  <Check className="size-3.5 shrink-0" aria-label="Delivered" />
                )
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
});
