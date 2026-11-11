import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
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
import type { UserRole } from "@/generated/prisma/client";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import {
  listAdminCustomers,
  type AdminCustomerListItemDTO,
} from "@/modules/customers/customer.service";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Customers",
};

const ROLE_OPTIONS: Array<UserRole | "ALL"> = ["ALL", "CUSTOMER", "STAFF", "ADMIN"];

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string }>;
}) {
  const [actor, sp] = await Promise.all([requirePermission("customers:read"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const role = ROLE_OPTIONS.includes(sp.role as UserRole | "ALL")
    ? (sp.role as UserRole | "ALL")
    : "ALL";
  const q = sp.q ?? "";

  const data = await listAdminCustomers({ page, pageSize: 20, q, role }, actor);
  const canExportCustomers = hasPermission(actor.user.role, "customers:export");

  const columns: ResponsiveColumn<AdminCustomerListItemDTO>[] = [
    {
      key: "name",
      header: "Client",
      cell: (row) => (
        <div>
          <Link
            href={`/admin/customers/${row.id}`}
            className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => (
        <Badge variant={row.role === "ADMIN" ? "primary" : "outline"}>{row.role}</Badge>
      ),
    },
    {
      key: "phone",
      header: "Telephone",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.phone ?? "—"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      cell: (row) => <span className="tabular-nums-price">{row.orderCount}</span>,
    },
    {
      key: "spend",
      header: "Lifetime Spend",
      className: "text-right",
      cell: (row) => (
        <span className="font-medium tabular-nums-price">
          {formatMoneyExact(row.lifetimeSpend, row.currency)}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  function buildHref(nextPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    if (q) qs.set("q", q);
    if (role !== "ALL") qs.set("role", role);
    return `/admin/customers?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-editorial-label text-accent-text">Client Registry</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Customers &amp; Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} accounts registered
            {data.piiMasked ? " · Phone & street PII masked for Staff access" : ""}
          </p>
        </div>

        {canExportCustomers && <CsvExportLink resource="customers" label="Export Customers CSV" />}
      </div>

      <form
        method="GET"
        action="/admin/customers"
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-7">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by client name or email..."
            aria-label="Search customers"
          />
        </div>
        <div className="sm:col-span-3">
          <NativeSelect name="role" defaultValue={role} aria-label="Filter by role">
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All Roles" : r}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      <ResponsiveDataTable
        data={data.customers}
        columns={columns}
        keyExtractor={(row) => row.id}
        mobileTitle={(row) => (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/admin/customers/${row.id}`}
              className="font-display text-lg font-medium text-foreground underline underline-offset-4"
            >
              {row.name}
            </Link>
            <Badge variant={row.role === "ADMIN" ? "primary" : "outline"}>{row.role}</Badge>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title="No customer accounts matched"
            description="Adjust your search or role filter."
          />
        }
      />

      <Pagination currentPage={data.page} totalPages={data.totalPages} buildHref={buildHref} />
    </div>
  );
}
