import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
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
          className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "summary",
      header: "Pieces",
      cell: (row) => (
        <span>
          {row.firstItemTitle}
          {row.itemCount > 1 ? ` + ${row.itemCount - 1} more` : ""}
        </span>
      ),
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
        <span className="font-medium tabular-nums-price">
          {formatMoneyExact(row.total, row.currency)}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      hideOnMobileCard: true,
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/account/orders/${encodeURIComponent(row.orderNumber)}`}>Inspect</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-medium text-foreground">Commission History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
              className="font-display text-lg font-medium text-foreground underline underline-offset-4"
            >
              {row.orderNumber}
            </Link>
            <Badge variant={ORDER_STATUS_META[row.status].badgeVariant}>
              {ORDER_STATUS_META[row.status].label}
            </Badge>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={Package}
            title="You have no orders yet"
            description="Your confirmed reservations, courier tracking numbers, and invoices will appear here."
            actionLabel="Browse Collection"
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
