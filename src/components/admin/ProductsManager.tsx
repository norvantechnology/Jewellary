"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Gem, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { deleteProductAction } from "@/modules/catalog/catalog.actions";
import type { AdminCategoryDTO, AdminProductListItem } from "@/modules/catalog/catalog.service";

export function ProductsManager({
  items,
  categories,
  total,
  page,
  totalPages,
  initialSearch,
  initialStatus,
  initialCategoryId,
  canDelete,
  currency,
}: {
  items: AdminProductListItem[];
  categories: AdminCategoryDTO[];
  total: number;
  page: number;
  totalPages: number;
  initialSearch: string;
  initialStatus: string;
  initialCategoryId: string;
  canDelete: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState(initialStatus || "ALL");
  const [categoryId, setCategoryId] = React.useState(initialCategoryId || "__all__");
  const [deleteTarget, setDeleteTarget] = React.useState<AdminProductListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function buildHref(
    nextPage: number,
    nextSearch = search,
    nextStatus = status,
    nextCat = categoryId,
  ) {
    const sp = new URLSearchParams();
    if (nextSearch.trim()) sp.set("q", nextSearch.trim());
    if (nextStatus && nextStatus !== "ALL") sp.set("status", nextStatus);
    if (nextCat && nextCat !== "__all__") sp.set("categoryId", nextCat);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(1));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteProductAction({ id: deleteTarget.id });
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Archived "${deleteTarget.name}".`);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: ResponsiveColumn<AdminProductListItem>[] = [
    {
      key: "piece",
      header: "Piece",
      cell: (p) => (
        <div className="flex items-center gap-3">
          {p.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.primaryImageUrl}
              alt={p.primaryAltText ?? p.name}
              className="size-12 shrink-0 rounded-sm border border-border object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
              <Gem className="size-4" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <Link
              href={`/admin/products/${p.id}`}
              className="font-medium text-foreground hover:text-accent-text hover:underline"
            >
              {p.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (p) => p.categoryName,
    },
    {
      key: "price",
      header: "Price",
      cell: (p) => (
        <span className="tabular-nums-price">
          {p.priceMode === "PRICE_ON_REQUEST"
            ? "Price on Request"
            : formatMoney(p.basePrice, currency)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Available",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <span className="tabular-nums-price">{p.availableStock}</span>
          {p.lowStock && <Badge variant="warning">Low</Badge>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <Badge
          variant={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "outline" : "default"}
        >
          {p.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/products/${p.id}`}>
              <Edit2 className="size-3.5" aria-hidden="true" />
              <span>Edit</span>
            </Link>
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(p)}
              aria-label={`Archive product ${p.name}`}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Fine Jewellery Catalogue</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Products ({total})
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage pieces, diamond 4Cs dossiers, multi-metal variants, imagery, and SEO metadata.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CsvExportLink resource="products" label="Export CSV" />
          <Button asChild className="gap-1.5">
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add Product</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-12"
      >
        <div className="relative sm:col-span-5">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search products by title, SKU, or slug"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, SKU, or slug..."
            className="pl-9"
          />
        </div>

        <div className="sm:col-span-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by product status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-1">
          <Button type="submit" variant="secondary" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      <ResponsiveDataTable
        data={items}
        columns={columns}
        keyExtractor={(p) => p.id}
        mobileTitle={(p) => p.name}
        emptyState={
          <EmptyState
            icon={Gem}
            title="No Matching Products"
            description="No pieces match your current filters, or your catalogue is empty."
            actionLabel="Add First Piece"
            actionHref="/admin/products/new"
          />
        }
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(next) => buildHref(next)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Archive Product"
        description={
          deleteTarget
            ? `Soft-delete and archive "${deleteTarget.name}"? Historical orders referencing its variants remain intact.`
            : ""
        }
        confirmLabel="Archive Product"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
