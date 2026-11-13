import { Suspense } from "react";
import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { listAdminCategories, listAdminFacets } from "@/modules/catalog/catalog.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Categories",
};

async function CategoriesContent() {
  const [categories, facets, session] = await Promise.all([
    listAdminCategories(),
    listAdminFacets(),
    getOptionalSession(),
  ]);
  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return <CategoriesManager categories={categories} facets={facets} canDelete={canDelete} />;
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CategoriesContent />
    </Suspense>
  );
}
