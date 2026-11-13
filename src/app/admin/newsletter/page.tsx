import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminNewsletterClient } from "@/components/admin/AdminNewsletterClient";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { NewsletterStatus } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { listAdminNewsletterSubscribers } from "@/modules/newsletter/newsletter.service";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Newsletter Subscribers",
};

const STATUS_OPTIONS: Array<NewsletterStatus | "ALL"> = [
  "ALL",
  "CONFIRMED",
  "PENDING",
  "UNSUBSCRIBED",
];

async function AdminNewsletterBody({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const [actor, sp] = await Promise.all([requirePermission("customers:read"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUS_OPTIONS.includes(sp.status as NewsletterStatus | "ALL")
    ? (sp.status as NewsletterStatus | "ALL")
    : "ALL";
  const q = sp.q ?? "";

  const data = await listAdminNewsletterSubscribers({
    page,
    pageSize: 20,
    status,
    search: q,
  });

  const canExport = hasPermission(actor.user.role, "customers:export");

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status !== "ALL") exportParams.set("status", status);

  function buildHref(nextPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    if (q) qs.set("q", q);
    if (status !== "ALL") qs.set("status", status);
    return `/admin/newsletter?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-editorial-label text-accent-text">Client Dispatches</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Newsletter Subscribers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.counts.confirmed} confirmed · {data.counts.pending} pending double opt-in ·{" "}
            {data.counts.unsubscribed} unsubscribed ({data.total} shown)
          </p>
        </div>
        {canExport && (
          <CsvExportLink
            resource="newsletter"
            label="Export Subscribers CSV"
            query={exportParams.toString() || undefined}
          />
        )}
      </div>

      <form
        method="GET"
        action="/admin/newsletter"
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-7">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search subscriber email or capture source..."
            aria-label="Search newsletter subscribers"
          />
        </div>
        <div className="sm:col-span-3">
          <NativeSelect
            name="status"
            defaultValue={status}
            aria-label="Filter by subscription status"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending Opt-In</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      <AdminNewsletterClient subscribers={data.items} />

      <p className="text-xs text-muted-foreground">
        Showing page {data.page} of {data.totalPages} ({data.total} subscribers)
      </p>

      <Pagination currentPage={data.page} totalPages={data.totalPages} buildHref={buildHref} />
    </div>
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}>
      <AdminNewsletterBody searchParams={searchParams} />
    </Suspense>
  );
}
