import { Suspense } from "react";
import type { Metadata } from "next";
import { FacetsManager } from "@/components/admin/FacetsManager";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { listAdminFacets } from "@/modules/catalog/catalog.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Attributes & Facets",
};

async function FacetsContent() {
  const [facets, session] = await Promise.all([listAdminFacets(), getOptionalSession()]);
  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return <FacetsManager facets={facets} canDelete={canDelete} />;
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminAttributesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FacetsContent />
    </Suspense>
  );
}
