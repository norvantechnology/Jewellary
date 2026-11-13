import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductStatus } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { listAdminCategories, listAdminProducts } from "@/modules/catalog/catalog.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Products",
};

const VALID_STATUSES = new Set(["ALL", "ACTIVE", "DRAFT", "ARCHIVED"]);

async function ProductsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const rawStatus = typeof sp.status === "string" ? sp.status : "ALL";
  const status = (VALID_STATUSES.has(rawStatus) ? rawStatus : "ALL") as ProductStatus | "ALL";
  const categoryId = typeof sp.categoryId === "string" ? sp.categoryId : "";
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1;

  const [listing, categories, settings, session] = await Promise.all([
    listAdminProducts({ search, status, categoryId: categoryId || undefined, page }),
    listAdminCategories(),
    getPublicStoreSettings(),
    getOptionalSession(),
  ]);

  const canDelete = session ? hasPermission(session.user.role, "catalog:delete") : false;

  return (
    <ProductsManager
      items={listing.items}
      categories={categories}
      total={listing.total}
      page={listing.page}
      totalPages={listing.totalPages}
      initialSearch={search}
      initialStatus={status}
      initialCategoryId={categoryId}
      canDelete={canDelete}
      currency={settings.currency}
    />
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}
