import type { Metadata } from "next";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { getAdminDashboardAnalytics } from "@/modules/admin/dashboard.service";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = {
  title: "Studio Overview",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [, sp] = await Promise.all([requirePermission("admin:dashboard"), searchParams]);
  const analytics = await getAdminDashboardAnalytics(sp.period);

  return <AdminDashboardClient data={analytics} />;
}
