import { Suspense } from "react";
import type { Metadata } from "next";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { Skeleton } from "@/components/ui/skeleton";
import { listAdminInventory, listInventoryTransactions } from "@/modules/catalog/catalog.service";

export const metadata: Metadata = {
  title: "Inventory & Ledger",
};

async function InventoryContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const onlyLowStock = sp.lowStock === "1";
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1;

  const [inventory, transactions] = await Promise.all([
    listAdminInventory({ search, onlyLowStock, page }),
    listInventoryTransactions({ limit: 25 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CsvExportLink resource="inventory" label="Export Inventory CSV" />
      </div>
      <InventoryManager
        variants={inventory.items}
        transactions={transactions}
        total={inventory.total}
        page={inventory.page}
        totalPages={inventory.totalPages}
        initialSearch={search}
        initialLowStock={onlyLowStock}
      />
    </div>
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <InventoryContent searchParams={searchParams} />
    </Suspense>
  );
}
