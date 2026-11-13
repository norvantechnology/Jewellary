import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCustomizationsClient } from "@/components/admin/AdminCustomizationsClient";
import { listAdminCustomizationRequests } from "@/modules/customization/customization.service";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPageSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Customization Requests",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminCustomizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaffPageSession("/admin/customizations");
  if (!session || !hasPermission(session.user.role, "customization:manage")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const str = (key: string, fallback = "") =>
    typeof sp[key] === "string" ? (sp[key] as string) : fallback;

  const status = str("status", "ALL") as
    | "ALL"
    | "SUBMITTED"
    | "IN_REVIEW"
    | "ACCEPTED"
    | "REJECTED"
    | "CANCELLED"
    | "EXPIRED"
    | "ORDERED";
  const rawSort = str("sort", "newest");
  const sortBy: "newest" | "oldest" | "quoted_high" | "expiring_soon" =
    rawSort === "oldest" || rawSort === "quoted_high" || rawSort === "expiring_soon"
      ? rawSort
      : "newest";
  const search = str("search");
  const dateFrom = str("dateFrom");
  const dateTo = str("dateTo");
  const page = Math.max(1, Number(str("page", "1")) || 1);

  const data = await listAdminCustomizationRequests({
    status,
    sortBy,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
  });

  return (
    <AdminCustomizationsClient
      initialData={data}
      filters={{ status, search, sort: sortBy, dateFrom, dateTo }}
    />
  );
}
