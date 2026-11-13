import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { OrderStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { listAdminOrders, type AdminOrderListItemDTO } from "@/modules/orders/admin-orders.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Orders",
};

const ALL_STATUSES: Array<OrderStatus | "ALL"> = [
  "ALL",
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PAID",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const [actor, sp] = await Promise.all([requirePermission("orders:read"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ALL_STATUSES.includes(sp.status as OrderStatus | "ALL")
    ? (sp.status as OrderStatus | "ALL")
    : "ALL";
  const q = sp.q ?? "";
  const dateFrom = sp.dateFrom ?? "";
  const dateTo = sp.dateTo ?? "";

  const data = await listAdminOrders({ page, pageSize: 20, q, status, dateFrom, dateTo });
  const canExport = hasPermission(actor.user.role, "exports:operational");

  const columns: ResponsiveColumn<AdminOrderListItemDTO>[] = [
    {
      key: "orderNumber",
      header: "Order",
      hideOnMobileCard: true,
      cell: (row) => (
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Client",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.customerEmail}</p>
        </div>
      ),
    },
    {
      key: "status",
      hideOnMobileCard: true,
      header: "Status",
      cell: (row) => {
        const meta = ORDER_STATUS_META[row.status];
        return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
      },
    },
    {
      key: "items",
      header: "Pieces",
      cell: (row) => <span className="tabular-nums-price">{row.itemCount}</span>,
    },
    {
      key: "total",
      header: "Total",
      className: "text-right",
      cell: (row) => (
        <div className="text-right">
          <span className="tabular-nums-price font-medium">
            {formatMoneyExact(row.total, row.currency, "en-US", row.currencyDecimals)}
          </span>
          {row.currency !== row.baseCurrency && (
            <p className="tabular-nums-price text-[11px] text-muted-foreground">
              Base: {formatMoneyExact(row.baseTotal, row.baseCurrency)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Placed",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      hideOnMobileCard: true,
      className: "text-right",
      cell: (row) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/orders/${row.id}`}>Manage</Link>
        </Button>
      ),
    },
  ];

  function buildHref(nextPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    if (q) qs.set("q", q);
    if (status !== "ALL") qs.set("status", status);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return `/admin/orders?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-editorial-label text-accent-text">Fulfillment Ledger</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "order" : "orders"} matching active filters.
          </p>
        </div>

        {canExport && <CsvExportLink resource="orders" label="Export Orders CSV" />}
      </div>

      <form
        method="GET"
        action="/admin/orders"
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-3">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Order #, client name, email, or waybill..."
            aria-label="Search orders"
          />
        </div>
        <div className="sm:col-span-3">
          <NativeSelect name="status" defaultValue={status} aria-label="Filter by order status">
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === "ALL" ? "All Statuses" : `${ORDER_STATUS_META[st].label} (${st})`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            aria-label="Filter orders from date"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            aria-label="Filter orders to date"
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" className="w-full px-3">
            Filter
          </Button>
        </div>
      </form>

      <ResponsiveDataTable
        data={data.orders}
        columns={columns}
        keyExtractor={(row) => row.id}
        mobileTitle={(row) => (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/admin/orders/${row.id}`}
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
            icon={ShoppingBag}
            title="No orders match those filters"
            description="Adjust the status or search terms, or wait for the next client reservation."
          />
        }
      />

      <Pagination currentPage={data.page} totalPages={data.totalPages} buildHref={buildHref} />
    </div>
  );
}
