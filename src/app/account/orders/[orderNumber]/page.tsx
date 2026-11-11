import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderDetailView } from "@/components/storefront/OrderDetailView";
import { getCustomerOrderDetail } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = {
  title: "Order Details",
};

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const [{ orderNumber }] = await Promise.all([params]);
  const { user } = await requirePageUser(`/account/orders/${orderNumber}`);
  const decoded = decodeURIComponent(orderNumber);

  let order;
  try {
    order = await getCustomerOrderDetail(user.id, decoded);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Orders
        </Link>
      </div>

      <OrderDetailView order={order} />
    </div>
  );
}
