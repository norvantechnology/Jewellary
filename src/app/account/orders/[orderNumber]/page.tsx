import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { BackLink } from "@/components/shared/BackLink";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderDetailView } from "@/components/storefront/OrderDetailView";
import { getCustomerOrderDetail } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";
import { NotFoundError } from "@/server/errors";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.account.orderDetail.seo, {
    pathname: "/account/orders",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

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
        <BackLink
          fallbackHref="/account/orders"
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground/45"
        >
          <ArrowLeft className="size-5 stroke-[1.5]" aria-hidden="true" />
          <span>{(await getSiteContent()).pages.account.orderDetail.backLabel}</span>
        </BackLink>
      </div>

      <OrderDetailView order={order} text={(await getSiteContent()).ui.orders} />
    </div>
  );
}
