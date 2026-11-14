import type { OrderStatus } from "@/generated/prisma/client";
import { SITE_CONTENT_DEFAULTS } from "@/modules/site-content/site-content.shared";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAYMENT_FAILED: ["PAID", "PENDING_PAYMENT", "CANCELLED"],
  PAID: ["PROCESSING", "PACKED", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PACKED", "SHIPPED", "CANCELLED", "REFUNDED"],
  PACKED: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

type BadgeVariant = "default" | "success" | "primary" | "outline" | "destructive" | "warning";

const ORDER_STATUS_BADGES: Record<OrderStatus, BadgeVariant> = {
  PENDING_PAYMENT: "warning",
  PAYMENT_FAILED: "destructive",
  PAID: "primary",
  PROCESSING: "primary",
  PACKED: "primary",
  SHIPPED: "success",
  DELIVERED: "success",
  CANCELLED: "outline",
  REFUNDED: "outline",
};

export type OrderStatusTexts = Record<OrderStatus, { label: string; description: string }>;

/**
 * Status label/description text comes from data/frontend/site-content.json → ui.orders.statuses.
 * Pass live `ui.orders.statuses` (getSiteContent() / useUiText()) to include Admin > Page Content
 * edits; without it the file defaults are used.
 */
export function getOrderStatusMeta(
  texts: OrderStatusTexts = SITE_CONTENT_DEFAULTS.ui.orders.statuses as OrderStatusTexts,
): Record<OrderStatus, { label: string; description: string; badgeVariant: BadgeVariant }> {
  return Object.fromEntries(
    (Object.keys(ORDER_STATUS_BADGES) as OrderStatus[]).map((status) => [
      status,
      { ...texts[status], badgeVariant: ORDER_STATUS_BADGES[status] },
    ]),
  ) as Record<OrderStatus, { label: string; description: string; badgeVariant: BadgeVariant }>;
}

/** File-default status text (see getOrderStatusMeta for live admin-edited text). */
export const ORDER_STATUS_META = getOrderStatusMeta();

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isCancellableBeforeSettlement(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";
}
