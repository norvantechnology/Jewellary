import type { Metadata } from "next";
import { AdminEnquiriesClient } from "@/components/admin/AdminEnquiriesClient";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { EnquiryStatus } from "@/generated/prisma/client";
import { listAdminEnquiries } from "@/modules/enquiries/enquiry.service";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Enquiries",
};

const ENQUIRY_FILTER_OPTIONS: Array<EnquiryStatus | "ALL"> = [
  "ALL",
  "NEW",
  "IN_PROGRESS",
  "RESOLVED",
];

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const [, sp] = await Promise.all([requirePermission("enquiries:manage"), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ENQUIRY_FILTER_OPTIONS.includes(sp.status as EnquiryStatus | "ALL")
    ? (sp.status as EnquiryStatus | "ALL")
    : "ALL";
  const q = sp.q ?? "";

  const data = await listAdminEnquiries({ page, pageSize: 15, status, q });

  function buildHref(nextPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(nextPage));
    if (q) qs.set("q", q);
    if (status !== "ALL") qs.set("status", status);
    return `/admin/enquiries?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-editorial-label text-accent-text">Bespoke Concierge</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Client Enquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.openCount} active enquiries requiring studio attention · {data.total} total shown.
        </p>
      </div>

      <form
        method="GET"
        action="/admin/enquiries"
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-7">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search client name, email, or enquiry text..."
            aria-label="Search enquiries"
          />
        </div>
        <div className="sm:col-span-3">
          <NativeSelect name="status" defaultValue={status} aria-label="Filter enquiries by status">
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      <AdminEnquiriesClient enquiries={data.enquiries} />

      <Pagination currentPage={data.page} totalPages={data.totalPages} buildHref={buildHref} />
    </div>
  );
}
