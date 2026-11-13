import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminOrderDetailClient } from "@/components/admin/AdminOrderDetailClient";
import { hasPermission } from "@/lib/permissions";
import { getAdminOrderDetail } from "@/modules/orders/admin-orders.service";
import { requirePermission } from "@/server/dal";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = {
  title: "Order Detail",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [actor, { id }] = await Promise.all([requirePermission("orders:read"), params]);

  let order;
  try {
    order = await getAdminOrderDetail(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink
          fallbackHref="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Orders
        </BackLink>
      </div>

      <AdminOrderDetailClient
        order={order}
        canRefund={hasPermission(actor.user.role, "orders:refund")}
        canCancelPaid={hasPermission(actor.user.role, "orders:cancel_paid")}
      />
    </div>
  );
}
