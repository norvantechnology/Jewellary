import "server-only";
import { OrderStatus, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { formatMoneyExact, subtractMoney, toDecimal } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import type {
  AdminRefundOrderInput,
  AdminUpdateOrderInput,
} from "@/modules/orders/admin-orders.schemas";
import type { CheckoutAddressInput } from "@/modules/orders/order.schemas";
import { createOrderTrackToken, releaseOrderReservationById } from "@/modules/orders/order.service";
import {
  ORDER_STATUS_META,
  canTransitionOrderStatus,
  isCancellableBeforeSettlement,
} from "@/modules/orders/state-machine";
import { getPaymentProvider } from "@/modules/payments";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { writeAuditLog } from "@/server/audit";
import type { AuthenticatedContext } from "@/server/dal";
import { db } from "@/server/db";
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from "@/server/email/send";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";

export interface AdminOrderListItemDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  userId: string | null;
  itemCount: number;
  currency: string;
  total: string;
  refundedAmount: string;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrderDetailDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  currency: string;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  refundedAmount: string;
  refundedAt: string | null;
  shippingMethodName: string;
  shippingAddress: CheckoutAddressInput;
  billingAddress: CheckoutAddressInput;
  giftNote: string | null;
  customerNote: string | null;
  internalNote: string | null;
  signatureRequired: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  reservedUntil: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    skuSnapshot: string;
    titleSnapshot: string;
    variantTitleSnapshot: string;
    imageUrlSnapshot: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  events: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    actorId: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    providerIntentId: string;
    providerChargeId: string | null;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  allowedNextStatuses: OrderStatus[];
  stockAlreadyReturned: boolean;
  store: {
    storeName: string;
    contactEmail: string;
    contactPhone: string | null;
    physicalStore: {
      name?: string;
      address?: string;
      hours?: string;
    } | null;
  };
}

export async function listAdminOrders(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: OrderStatus | "ALL";
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  orders: AdminOrderListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const q = params.q?.trim();

  const where: Prisma.OrderWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            { trackingNumber: { contains: q, mode: "insensitive" } },
            {
              user: {
                is: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { name: true, email: true, anonymizedAt: true } },
        items: { select: { quantity: true } },
      },
    }),
  ]);

  return {
    orders: rows.map((row) => {
      const shipping = row.shippingAddress as unknown as CheckoutAddressInput;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        customerName:
          row.user && !row.user.anonymizedAt
            ? row.user.name
            : (shipping?.fullName ?? "Guest Client"),
        customerEmail:
          row.user && !row.user.anonymizedAt
            ? row.user.email
            : (row.guestEmail ?? "noreply@anonymized.local"),
        userId: row.userId,
        itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
        currency: row.currency,
        total: row.total.toFixed(2),
        refundedAmount: row.refundedAmount.toFixed(2),
        carrier: row.carrier,
        trackingNumber: row.trackingNumber,
        createdAt: row.createdAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetailDTO> {
  const [settings, order, existingReturnTx] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true, anonymizedAt: true } },
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.inventoryTransaction.findFirst({
      where: {
        referenceType: "ORDER",
        referenceId: orderId,
        reason: "RETURN",
      },
      select: { id: true },
    }),
  ]);

  if (!order) {
    throw new NotFoundError("Order not found.");
  }

  const shipping = order.shippingAddress as unknown as CheckoutAddressInput;
  const billing = order.billingAddress as unknown as CheckoutAddressInput;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    userId: order.userId,
    customerName:
      order.user && !order.user.anonymizedAt
        ? order.user.name
        : (shipping?.fullName ?? "Guest Client"),
    customerEmail:
      order.user && !order.user.anonymizedAt
        ? order.user.email
        : (order.guestEmail ?? "noreply@anonymized.local"),
    currency: order.currency,
    subtotal: order.subtotal.toFixed(2),
    shippingCost: order.shippingCost.toFixed(2),
    taxAmount: order.taxAmount.toFixed(2),
    discountAmount: order.discountAmount.toFixed(2),
    total: order.total.toFixed(2),
    refundedAmount: order.refundedAmount.toFixed(2),
    refundedAt: order.refundedAt?.toISOString() ?? null,
    shippingMethodName: order.shippingMethodName,
    shippingAddress: shipping,
    billingAddress: billing,
    giftNote: order.giftNote,
    customerNote: order.customerNote,
    internalNote: order.internalNote,
    signatureRequired: order.signatureRequired,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    reservedUntil: order.reservedUntil?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      skuSnapshot: item.skuSnapshot,
      titleSnapshot: item.titleSnapshot,
      variantTitleSnapshot: item.variantTitleSnapshot,
      imageUrlSnapshot: item.imageUrlSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    events: order.events.map((evt) => ({
      id: evt.id,
      fromStatus: evt.fromStatus,
      toStatus: evt.toStatus,
      note: evt.note,
      actorId: evt.actorId,
      createdAt: evt.createdAt.toISOString(),
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerIntentId: p.providerIntentId,
      providerChargeId: p.providerChargeId,
      amount: p.amount.toFixed(2),
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    allowedNextStatuses: [order.status, ...(canTransitionTargets(order.status) ?? [])],
    stockAlreadyReturned: Boolean(existingReturnTx),
    store: {
      storeName: settings.storeName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      physicalStore: settings.physicalStore,
    },
  };
}

function canTransitionTargets(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case "PENDING_PAYMENT":
      return ["PAID", "PAYMENT_FAILED", "CANCELLED"];
    case "PAYMENT_FAILED":
      return ["PAID", "PENDING_PAYMENT", "CANCELLED"];
    case "PAID":
      return ["PROCESSING", "PACKED", "SHIPPED", "CANCELLED"];
    case "PROCESSING":
      return ["PACKED", "SHIPPED", "CANCELLED"];
    case "PACKED":
      return ["SHIPPED", "CANCELLED"];
    case "SHIPPED":
      return ["DELIVERED"];
    default:
      return [];
  }
}

async function restoreOrderStockInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  note: string,
  actorId: string | null,
): Promise<string[]> {
  const existingReturn = await tx.inventoryTransaction.findFirst({
    where: { referenceType: "ORDER", referenceId: orderId, reason: "RETURN" },
    select: { id: true },
  });
  if (existingReturn) {
    return [];
  }

  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    orderBy: { variantId: "asc" },
    select: { productId: true, variantId: true, quantity: true },
  });

  const productIds = new Set<string>();
  for (const item of orderItems) {
    productIds.add(item.productId);
    const updated = await tx.$queryRaw<Array<{ stockQty: number; reservedQty: number }>>`
      UPDATE "ProductVariant"
      SET "stockQty" = "stockQty" + ${item.quantity},
          "updatedAt" = NOW()
      WHERE id = ${item.variantId}
      RETURNING "stockQty", "reservedQty"
    `;
    const uv = updated[0];
    if (uv) {
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.variantId,
          reason: "RETURN",
          delta: item.quantity,
          balanceAfter: Math.max(0, uv.stockQty - uv.reservedQty),
          referenceType: "ORDER",
          referenceId: orderId,
          note,
          actorId,
        },
      });
    }
  }

  return Array.from(productIds);
}

export async function updateAdminOrderStatus(
  input: AdminUpdateOrderInput,
  actor: AuthenticatedContext,
) {
  const existing = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { name: true, email: true, anonymizedAt: true } },
      items: { select: { productId: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Order not found.");
  }

  const isStatusChange = input.toStatus !== existing.status;

  if (isStatusChange && !canTransitionOrderStatus(existing.status, input.toStatus)) {
    throw new ConflictError(
      `Invalid status transition from ${existing.status} to ${input.toStatus}.`,
    );
  }

  if (isStatusChange && input.toStatus === "REFUNDED") {
    throw new ValidationError("Use the dedicated Refund flow to issue monetary refunds.");
  }

  const isPaidPreDispatch =
    existing.status === "PAID" || existing.status === "PROCESSING" || existing.status === "PACKED";

  if (
    isStatusChange &&
    input.toStatus === "CANCELLED" &&
    isPaidPreDispatch &&
    !hasPermission(actor.user.role, "orders:cancel_paid")
  ) {
    throw new ForbiddenError("Only administrators can cancel settled orders.");
  }

  const beforeSnapshot = {
    status: existing.status,
    carrier: existing.carrier,
    trackingNumber: existing.trackingNumber,
    trackingUrl: existing.trackingUrl,
    internalNote: existing.internalNote,
  };

  let touchedProductIds = existing.items.map((i) => i.productId);

  await db.$transaction(async (tx) => {
    if (isStatusChange && input.toStatus === "CANCELLED") {
      if (isCancellableBeforeSettlement(existing.status)) {
        await releaseOrderReservationById(
          tx,
          existing.id,
          "CANCELLED",
          input.customerNote ?? "Cancelled by studio staff before settlement.",
          actor.user.id,
        );
      } else {
        await restoreOrderStockInTx(
          tx,
          existing.id,
          input.customerNote ?? "Paid order cancelled by administrator.",
          actor.user.id,
        );
        await tx.order.update({
          where: { id: existing.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            internalNote: input.internalNote ?? existing.internalNote,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: existing.id,
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            note: input.customerNote ?? "Order cancelled by administrator.",
            actorId: actor.user.id,
          },
        });
      }
      if (input.internalNote !== existing.internalNote) {
        await tx.order.update({
          where: { id: existing.id },
          data: { internalNote: input.internalNote ?? null },
        });
      }
      return;
    }

    const now = new Date();
    await tx.order.update({
      where: { id: existing.id },
      data: {
        ...(isStatusChange ? { status: input.toStatus } : {}),
        ...(isStatusChange && input.toStatus === "PAID" && !existing.paidAt
          ? { paidAt: now, reservedUntil: null }
          : {}),
        ...(isStatusChange && input.toStatus === "SHIPPED" && !existing.shippedAt
          ? { shippedAt: now }
          : {}),
        ...(isStatusChange && input.toStatus === "DELIVERED" && !existing.deliveredAt
          ? { deliveredAt: now }
          : {}),
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        trackingUrl: input.trackingUrl ?? null,
        internalNote: input.internalNote ?? null,
      },
    });

    if (isStatusChange || input.customerNote) {
      await tx.orderEvent.create({
        data: {
          orderId: existing.id,
          fromStatus: existing.status,
          toStatus: input.toStatus,
          note:
            input.customerNote ??
            (isStatusChange
              ? `Status updated to ${ORDER_STATUS_META[input.toStatus].label}.`
              : "Tracking or concierge update recorded."),
          actorId: actor.user.id,
        },
      });
    }
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: isStatusChange ? "order.status_updated" : "order.details_updated",
    entityType: "Order",
    entityId: existing.id,
    before: beforeSnapshot,
    after: {
      status: input.toStatus,
      carrier: input.carrier ?? null,
      trackingNumber: input.trackingNumber ?? null,
      trackingUrl: input.trackingUrl ?? null,
      internalNote: input.internalNote ?? null,
    },
  });

  const recipientEmail =
    existing.user && !existing.user.anonymizedAt ? existing.user.email : existing.guestEmail;
  if (input.notifyCustomer && recipientEmail) {
    const shipping = existing.shippingAddress as unknown as CheckoutAddressInput;
    const recipientName =
      existing.user && !existing.user.anonymizedAt
        ? existing.user.name
        : (shipping?.fullName ?? "Valued Client");
    const trackToken = createOrderTrackToken(existing.orderNumber);
    const orderUrl = `${env.NEXT_PUBLIC_SITE_URL}/orders/${encodeURIComponent(existing.orderNumber)}/confirmation?token=${encodeURIComponent(trackToken)}`;

    try {
      await sendOrderStatusEmail({
        to: recipientEmail,
        recipientName,
        orderNumber: existing.orderNumber,
        statusLabel: ORDER_STATUS_META[input.toStatus].label,
        message: input.customerNote ?? ORDER_STATUS_META[input.toStatus].description,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        orderUrl,
      });
    } catch (error) {
      logger.warn(
        {
          orderId: existing.id,
          err: error instanceof Error ? error.message : String(error),
        },
        "Order status email failed; DB update persisted cleanly",
      );
    }
  }

  touchedProductIds = Array.from(new Set(touchedProductIds));
  return {
    orderId: existing.id,
    orderNumber: existing.orderNumber,
    status: input.toStatus,
    productIds: touchedProductIds,
  };
}

export async function issueAdminOrderRefund(
  input: AdminRefundOrderInput,
  actor: AuthenticatedContext,
) {
  if (!hasPermission(actor.user.role, "orders:refund")) {
    throw new ForbiddenError("Only administrators are authorized to issue payment refunds.");
  }

  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { name: true, email: true, anonymizedAt: true } },
      items: { select: { productId: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found.");
  }

  const refundableStatuses: OrderStatus[] = [
    "PAID",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
  ];
  if (!refundableStatuses.includes(order.status)) {
    throw new ConflictError(`Order in status ${order.status} cannot be refunded.`);
  }

  const settledPayment =
    order.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") ??
    order.payments[0];

  if (!settledPayment) {
    throw new ConflictError("No settled payment transaction found for this order.");
  }

  const requestedDec = toDecimal(input.amount);
  if (requestedDec.lte(0)) {
    throw new ValidationError("Refund amount must be greater than zero.");
  }

  const remainingRefundable = subtractMoney(order.total, order.refundedAmount);
  if (requestedDec.gt(remainingRefundable)) {
    throw new ValidationError(
      `Refund amount cannot exceed remaining balance of ${formatMoneyExact(remainingRefundable, order.currency)}.`,
    );
  }

  const adapter = getPaymentProvider(settledPayment.provider);
  const refundResult = await adapter.createRefund({
    providerIntentId: settledPayment.providerIntentId,
    providerChargeId: settledPayment.providerChargeId,
    amountDecimal: requestedDec.toFixed(2),
    currency: order.currency,
    reason: input.reason,
  });

  const newRefundedTotal = toDecimal(order.refundedAmount).plus(requestedDec);
  const isFullRefund = newRefundedTotal.gte(toDecimal(order.total));
  const nextOrderStatus: OrderStatus = isFullRefund ? "REFUNDED" : order.status;

  let restoredProducts: string[] = [];

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedAmount: new Prisma.Decimal(newRefundedTotal.toFixed(2)),
        refundedAt: new Date(),
        ...(isFullRefund ? { status: "REFUNDED" } : {}),
      },
    });

    await tx.paymentTransaction.update({
      where: { id: settledPayment.id },
      data: {
        status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        rawResponse: refundResult.rawResponse as Prisma.InputJsonValue,
      },
    });

    if (input.restoreStock) {
      restoredProducts = await restoreOrderStockInTx(
        tx,
        order.id,
        `Stock restored upon refund (${refundResult.refundId})`,
        actor.user.id,
      );
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: nextOrderStatus,
        note: `Refund ${formatMoneyExact(requestedDec, order.currency)} issued (${refundResult.refundId}): ${input.reason}`,
        actorId: actor.user.id,
      },
    });
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: "order.refund",
    entityType: "Order",
    entityId: order.id,
    before: {
      status: order.status,
      refundedAmount: order.refundedAmount.toFixed(2),
    },
    after: {
      status: nextOrderStatus,
      refundedAmount: newRefundedTotal.toFixed(2),
      refundAmount: requestedDec.toFixed(2),
      refundId: refundResult.refundId,
      restoreStock: input.restoreStock,
      reason: input.reason,
    },
  });

  const recipientEmail =
    order.user && !order.user.anonymizedAt ? order.user.email : order.guestEmail;
  if (input.notifyCustomer && recipientEmail) {
    const shipping = order.shippingAddress as unknown as CheckoutAddressInput;
    const recipientName =
      order.user && !order.user.anonymizedAt
        ? order.user.name
        : (shipping?.fullName ?? "Valued Client");
    const trackToken = createOrderTrackToken(order.orderNumber);
    const orderUrl = `${env.NEXT_PUBLIC_SITE_URL}/orders/${encodeURIComponent(order.orderNumber)}/confirmation?token=${encodeURIComponent(trackToken)}`;

    try {
      await sendOrderStatusEmail({
        to: recipientEmail,
        recipientName,
        orderNumber: order.orderNumber,
        statusLabel: isFullRefund ? "Order Refunded" : "Partial Refund Issued",
        message: `A refund of ${formatMoneyExact(requestedDec, order.currency)} has been processed to your original payment method. Reason: ${input.reason}`,
        orderUrl,
      });
    } catch (error) {
      logger.warn(
        {
          orderId: order.id,
          err: error instanceof Error ? error.message : String(error),
        },
        "Refund notification email failed; refund transaction persisted cleanly",
      );
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundId: refundResult.refundId,
    refundedAmount: newRefundedTotal.toFixed(2),
    status: nextOrderStatus,
    productIds: Array.from(new Set(restoredProducts)),
  };
}

export async function resendAdminOrderConfirmationEmail(
  orderId: string,
  actor: AuthenticatedContext,
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true, anonymizedAt: true } },
      items: true,
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found.");
  }

  const recipientEmail =
    order.user && !order.user.anonymizedAt ? order.user.email : order.guestEmail;
  if (!recipientEmail) {
    throw new ValidationError("No contact email is associated with this order.");
  }

  const shipping = order.shippingAddress as unknown as CheckoutAddressInput;
  const recipientName =
    order.user && !order.user.anonymizedAt
      ? order.user.name
      : (shipping?.fullName ?? "Valued Client");
  const trackToken = createOrderTrackToken(order.orderNumber);
  const trackingUrl = `${env.NEXT_PUBLIC_SITE_URL}/orders/${encodeURIComponent(order.orderNumber)}/confirmation?token=${encodeURIComponent(trackToken)}`;

  await sendOrderConfirmationEmail({
    to: recipientEmail,
    recipientName,
    orderNumber: order.orderNumber,
    lines: order.items.map((item) => ({
      title: item.titleSnapshot,
      variantTitle: item.variantTitleSnapshot,
      quantity: item.quantity,
      lineTotalFormatted: formatMoneyExact(item.lineTotal, order.currency),
    })),
    subtotalFormatted: formatMoneyExact(order.subtotal, order.currency),
    shippingFormatted:
      Number(order.shippingCost) === 0
        ? "Complimentary"
        : formatMoneyExact(order.shippingCost, order.currency),
    taxFormatted: formatMoneyExact(order.taxAmount, order.currency),
    totalFormatted: formatMoneyExact(order.total, order.currency),
    trackingUrl,
    signatureRequired: order.signatureRequired,
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: "order.resend_confirmation",
    entityType: "Order",
    entityId: order.id,
    after: { recipientEmail },
  });

  return { sentTo: recipientEmail };
}
