import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
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
import { formatDate } from "@/lib/dates";
import { listAuditLogs, type AuditLogEntryDTO } from "@/modules/audit/audit.service";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Security Audit Log",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    actorEmail?: string;
    action?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const [, sp] = await Promise.all([requirePermission("audit:read"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const actorEmail = sp.actorEmail ?? "";
  const action = sp.action ?? "";
  const entityType = sp.entityType ?? "ALL";
  const dateFrom = sp.dateFrom ?? "";
  const dateTo = sp.dateTo ?? "";

  const data = await listAuditLogs({
    page,
    pageSize: 25,
    actorEmail,
    action,
    entityType,
    dateFrom,
    dateTo,
  });

  const columns: ResponsiveColumn<AuditLogEntryDTO>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.actorEmail ?? "System"}</p>
          {row.actorRole && <span className="text-xs text-muted-foreground">{row.actorRole}</span>}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (row) => <Badge variant="outline">{row.action}</Badge>,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (row) => (
        <div className="text-xs">
          <p className="font-medium text-foreground">{row.entityType}</p>
          {row.entityId && <p className="text-muted-foreground">{row.entityId}</p>}
        </div>
      ),
    },
    {
      key: "diff",
      header: "Change Snapshot",
      cell: (row) => (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-accent-text">Inspect JSON</summary>
          <div className="mt-2 max-w-sm space-y-1.5 rounded-sm border border-border bg-muted/40 p-2 font-mono text-[11px] break-all">
            {row.before !== null && row.before !== undefined && (
              <div>
                <p className="font-semibold text-muted-foreground">Before:</p>
                <pre className="whitespace-pre-wrap">{JSON.stringify(row.before, null, 2)}</pre>
              </div>
            )}
            {row.after !== null && row.after !== undefined && (
              <div>
                <p className="font-semibold text-foreground">After:</p>
                <pre className="whitespace-pre-wrap">{JSON.stringify(row.after, null, 2)}</pre>
              </div>
            )}
          </div>
        </details>
      ),
    },
  ];

  function buildHref(nextPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    if (actorEmail) qs.set("actorEmail", actorEmail);
    if (action) qs.set("action", action);
    if (entityType !== "ALL") qs.set("entityType", entityType);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return `/admin/audit-log?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-editorial-label text-accent-text">Governance &amp; Compliance</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable log of studio mutations, role updates, refunds, and exports ({data.total}{" "}
          records).
        </p>
      </div>

      <form
        method="GET"
        action="/admin/audit-log"
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-3">
          <Input
            name="actorEmail"
            defaultValue={actorEmail}
            placeholder="Actor email..."
            aria-label="Filter by actor email"
          />
        </div>
        <div className="sm:col-span-3">
          <Input
            name="action"
            defaultValue={action}
            placeholder="Action e.g. order.refund..."
            aria-label="Filter by action name"
          />
        </div>
        <div className="sm:col-span-2">
          <NativeSelect
            name="entityType"
            defaultValue={entityType}
            aria-label="Filter by entity type"
          >
            <option value="ALL">All Entities</option>
            {data.entityTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Input type="date" name="dateFrom" defaultValue={dateFrom} aria-label="From date" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      <ResponsiveDataTable
        data={data.logs}
        columns={columns}
        keyExtractor={(row) => row.id}
        mobileTitle={(row) => (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">{row.action}</span>
            <Badge variant="outline">{row.entityType}</Badge>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={ScrollText}
            title="No audit events match filters"
            description="Sensitive studio mutations appear chronologically here."
          />
        }
      />

      <Pagination currentPage={data.page} totalPages={data.totalPages} buildHref={buildHref} />
    </div>
  );
}
