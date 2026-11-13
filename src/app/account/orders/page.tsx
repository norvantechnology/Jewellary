import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gem, Package } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import {
  listCustomerOrders,
  type CustomerOrderSummaryDTO,
} from "@/modules/account/account.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "My Orders",
};

function OrderThumbnailStrip({ order }: { order: CustomerOrderSummaryDTO }) {
  const thumbs = order.itemThumbnails;
  return (
    <div className="flex items-center justify-end gap-2.5 md:justify-start">
      <div className="flex shrink-0 -space-x-2">
        {thumbs.length > 0 ? (
          thumbs.map((thumb, idx) => {
            const isSeedImage = thumb.imageUrl?.startsWith("/images/seed/") ?? false;
            return (
              <div
                key={`${order.id}-thumb-${idx}`}
                className="relative flex size-9 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2 ring-1 ring-card"
              >
                {thumb.imageUrl ? (
                  <Image
                    src={thumb.imageUrl}
                    alt={thumb.title}
                    fill
                    sizes="36px"
                    className={
                      isSeedImage
                        ? "object-cover object-center dark:brightness-90"
                        : "object-cover object-center"
                    }
                  />
                ) : (
                  <Gem className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
            );
          })
        ) : (
          <div className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-2">
            <Gem className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <span className="min-w-0 truncate text-sm text-foreground">
        {order.firstItemTitle}
        {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : ""}
      </span>
    </div>
  );
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ user }, sp] = await Promise.all([requirePageUser("/account/orders"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listCustomerOrders(user.id, { page, pageSize: 10 });

  const columns: ResponsiveColumn<CustomerOrderSummaryDTO>[] = [
    {
      key: "orderNumber",
      header: "Order",
      cell: (row) => (
        <Link
          href={`/account/orders/${encodeURIComponent(row.orderNumber)}`}
          className="tabular-nums-price font-semibold text-foreground underline underline-offset-4 hover:text-accent-text"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => (
        <span className="tabular-nums-price text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "summary",
      header: "Pieces",
      cell: (row) => <OrderThumbnailStrip order={row} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const meta = ORDER_STATUS_META[row.status];
        return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
      },
    },
    {
      key: "total",
      header: "Total",
      className: "text-right",
      cell: (row) => (
        <div className="text-right">
          <span className="tabular-nums-price font-semibold text-foreground">
            {formatMoneyExact(row.total, row.currency, "en-US", row.currencyDecimals)}
          </span>
          {row.currency !== row.baseCurrency && (
            <p className="tabular-nums-price text-[11px] text-muted-foreground">
              {formatMoneyExact(row.baseTotal, row.baseCurrency, "en-US", 2)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      hideOnMobileCard: true,
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm" className="min-h-11 md:min-h-10">
          <Link href={`/account/orders/${encodeURIComponent(row.orderNumber)}`}>View details</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
          Commission History
        </h2>
        <p className="tabular-nums-price mt-1 text-sm text-muted-foreground">
          {data.total} {data.total === 1 ? "order" : "orders"} recorded in your account.
        </p>
      </div>

      <ResponsiveDataTable
        data={data.orders}
        columns={columns}
        keyExtractor={(row) => row.id}
        mobileTitle={(row) => (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/account/orders/${encodeURIComponent(row.orderNumber)}`}
              className="tabular-nums-price text-base font-semibold text-foreground underline underline-offset-4"
            >
              {row.orderNumber}
            </Link>
            <Badge variant={ORDER_STATUS_META[row.status].badgeVariant}>
              {ORDER_STATUS_META[row.status].label}
            </Badge>
          </div>
        )}
        mobileFooter={(row) => (
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link href={`/account/orders/${encodeURIComponent(row.orderNumber)}`}>
              View details
            </Link>
          </Button>
        )}
        emptyState={
          <EmptyState
            icon={Package}
            title="You have no orders yet"
            description="Your confirmed reservations, courier tracking numbers, and invoices will appear here."
            actionLabel="Start shopping"
            actionHref="/collections"
          />
        }
      />

      <Pagination
        currentPage={data.page}
        totalPages={data.totalPages}
        buildHref={(nextPage) => `/account/orders?page=${nextPage}`}
      />
    </div>
  );
}
