import type { OrderStatus } from "@/generated/prisma/client";

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

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    description: string;
    badgeVariant: "default" | "success" | "primary" | "outline" | "destructive" | "warning";
  }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting Payment",
    description: "Your piece is reserved in our vault while payment authorization completes.",
    badgeVariant: "warning",
  },
  PAYMENT_FAILED: {
    label: "Payment Attention Needed",
    description:
      "Authorization could not be completed. Retry payment within your reservation window.",
    badgeVariant: "destructive",
  },
  PAID: {
    label: "Order Confirmed",
    description: "Payment settled cleanly and your pieces are queued for atelier inspection.",
    badgeVariant: "primary",
  },
  PROCESSING: {
    label: "Atelier Inspection",
    description:
      "Our gemologists and bench jewellers are completing final polish and certification checks.",
    badgeVariant: "primary",
  },
  PACKED: {
    label: "Sealed for Dispatch",
    description: "Secured inside tamper-evident presentation packaging with grading documentation.",
    badgeVariant: "primary",
  },
  SHIPPED: {
    label: "In Insured Transit",
    description: "Collected by armoured or insured express courier with signature verification.",
    badgeVariant: "success",
  },
  DELIVERED: {
    label: "Delivered",
    description: "Signed for at the destination address.",
    badgeVariant: "success",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "Order cancelled and reserved vault inventory released.",
    badgeVariant: "outline",
  },
  REFUNDED: {
    label: "Refunded",
    description: "Refund issued back to the original payment method.",
    badgeVariant: "outline",
  },
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isCancellableBeforeSettlement(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";
}
