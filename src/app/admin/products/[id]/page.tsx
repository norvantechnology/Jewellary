import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/permissions";
import {
  getAdminProductById,
  listAdminCategories,
  listAdminFacets,
} from "@/modules/catalog/catalog.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Edit Product",
};

async function EditProductContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories, facets, settings, session] = await Promise.all([
    getAdminProductById(id).catch(() => null),
    listAdminCategories(),
    listAdminFacets(),
    getPublicStoreSettings(),
    getOptionalSession(),
  ]);

  if (!product) {
    notFound();
  }

  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return (
    <ProductEditor
      product={product}
      categories={categories}
      facets={facets}
      siteName={settings.storeName}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
      canDelete={canDelete}
    />
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EditProductContent params={params} />
    </Suspense>
  );
}
