import { Suspense } from "react";
import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { ShapeThumbnailsManager } from "@/components/admin/ShapeThumbnailsManager";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { listAdminCategories, listAdminFacets } from "@/modules/catalog/catalog.service";
import { listAllLandingFacetsAdmin } from "@/modules/seo/seo.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Categories",
};

async function CategoriesContent() {
  const [categories, facets, session, landingFacets] = await Promise.all([
    listAdminCategories(),
    listAdminFacets(),
    getOptionalSession(),
    listAllLandingFacetsAdmin(),
  ]);
  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return (
    <div className="space-y-6">
      <CategoriesManager categories={categories} facets={facets} canDelete={canDelete} />
      <ShapeThumbnailsManager facets={landingFacets} />
    </div>
  );
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
