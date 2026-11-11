import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/permissions";
import { listAdminCategories, listAdminFacets } from "@/modules/catalog/catalog.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "New Product",
};

async function NewProductContent() {
  const [categories, facets, settings, session] = await Promise.all([
    listAdminCategories(),
    listAdminFacets(),
    getPublicStoreSettings(),
    getOptionalSession(),
  ]);
  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return (
    <ProductEditor
      product={null}
      categories={categories}
      facets={facets}
      siteName={settings.storeName}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
      canDelete={canDelete}
    />
  );
}

export default function AdminNewProductPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NewProductContent />
    </Suspense>
  );
}
