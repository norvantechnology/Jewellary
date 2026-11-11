"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  adminRefundOrderSchema,
  adminResendOrderEmailSchema,
  adminUpdateOrderSchema,
} from "@/modules/orders/admin-orders.schemas";
import {
  issueAdminOrderRefund,
  resendAdminOrderConfirmationEmail,
  updateAdminOrderStatus,
} from "@/modules/orders/admin-orders.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";

function revalidateAdminOrderCaches(orderId: string, productIds: string[] = []) {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/audit-log");
  if (productIds.length > 0) {
    revalidateTag(CACHE_TAGS.products, "max");
    for (const pid of productIds) {
      revalidateTag(CACHE_TAGS.product(pid), "max");
    }
  }
}

export const adminUpdateOrderStatusAction = createAction(
  {
    name: "admin.orders.updateStatus",
    schema: adminUpdateOrderSchema,
    auth: { permission: "orders:update_status" },
    rateLimit: { tier: "adminWrite" },
  },
  async (input, { auth }) => {
    const res = await updateAdminOrderStatus(input, auth!);
    revalidateAdminOrderCaches(res.orderId, res.productIds);
    return res;
  },
);

export const adminRefundOrderAction = createAction(
  {
    name: "admin.orders.refund",
    schema: adminRefundOrderSchema,
    auth: { permission: "orders:refund" },
    rateLimit: { tier: "adminWrite" },
  },
  async (input, { auth }) => {
    const res = await issueAdminOrderRefund(input, auth!);
    revalidateAdminOrderCaches(res.orderId, res.productIds);
    return res;
  },
);

export const adminResendOrderEmailAction = createAction(
  {
    name: "admin.orders.resendEmail",
    schema: adminResendOrderEmailSchema,
    auth: { permission: "orders:update_status" },
    rateLimit: { tier: "adminWrite" },
  },
  async ({ orderId }, { auth }) => {
    const res = await resendAdminOrderConfirmationEmail(orderId, auth!);
    revalidatePath(`/admin/orders/${orderId}`);
    return res;
  },
);
