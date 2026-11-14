"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit2, Gem, Percent, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { BulkPriceDialog, type BulkPriceTarget } from "@/components/admin/BulkPriceDialog";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import { ProductDeleteDialog } from "@/components/admin/ProductDeleteDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { archiveProductAction, duplicateProductAction } from "@/modules/catalog/catalog.actions";
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
  const [archiveTarget, setArchiveTarget] = React.useState<AdminProductListItem | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminProductListItem | null>(null);
  // Bulk selection: individual ids, or "every product matching the current filters".
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const pageIds = items.map((p) => p.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageSomeSelected = pageIds.some((id) => selected.has(id));
  const selectedCount = allMatching ? total : selected.size;

  function toggleOne(id: string, on: boolean) {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function togglePage(on: boolean) {
    setAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
    setAllMatching(false);
  }
  const bulkTarget: BulkPriceTarget = allMatching
    ? {
        kind: "filter",
        filter: {
          search: initialSearch || undefined,
          status: (initialStatus || "ALL") as "ALL" | "ACTIVE" | "DRAFT" | "ARCHIVED",
          categoryId: initialCategoryId || undefined,
        },
      }
    : { kind: "ids", productIds: [...selected] };

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

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const res = await archiveProductAction({ id: archiveTarget.id });
    setArchiving(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Archived "${archiveTarget.name}".`);
    setArchiveTarget(null);
    router.refresh();
  }

  async function handleDuplicate(p: AdminProductListItem) {
    setDuplicatingId(p.id);
    const res = await duplicateProductAction({ id: p.id });
    setDuplicatingId(null);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Duplicated "${p.name}" as Draft.`);
    router.replace(`/admin/products/${res.data.id}`);
  }

  const columns: ResponsiveColumn<AdminProductListItem>[] = [
    {
      key: "select",
      header: "",
      className: "w-10",
      cell: (p) => (
        <Checkbox
          checked={allMatching || selected.has(p.id)}
          onCheckedChange={(v) => toggleOne(p.id, v === true)}
          aria-label={`Select ${p.name}`}
        />
      ),
    },
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
      header: "Stock",
      cell: (p) =>
        // Made-to-order products carry effectively unlimited stock (1,000,000 per variant).
        p.availableStock >= 1_000_000 ? (
          <Badge variant="info">Made to order</Badge>
        ) : (
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
        <div className="flex justify-end gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/products/${p.id}`}>
              <Edit2 className="size-3.5" aria-hidden="true" />
              <span>Edit</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            loading={duplicatingId === p.id}
            onClick={() => void handleDuplicate(p)}
            aria-label={`Duplicate product ${p.name}`}
            title="Duplicate product as Draft"
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          {p.status !== "ARCHIVED" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setArchiveTarget(p)}
              aria-label={`Archive product ${p.name}`}
              title="Archive product"
            >
              <Archive className="size-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(p)}
              aria-label={`Delete product ${p.name}`}
              title="Delete permanently"
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
          <p className="text-editorial-label text-accent-text">Catalog</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Products ({total})
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage products, prices, sizes, photos and SEO. Select products to change prices in
            bulk.
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
        <div className="relative sm:col-span-4">
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

        <div className="sm:col-span-2">
          <Button type="submit" variant="secondary" className="w-full px-3">
            Filter
          </Button>
        </div>
      </form>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={
                allMatching || pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false
              }
              onCheckedChange={(v) => togglePage(v === true)}
              aria-label="Select all products on this page"
            />
            <span>Select page ({items.length})</span>
          </label>
          {(pageAllSelected || allMatching) && total > items.length && (
            <button
              type="button"
              onClick={() => setAllMatching((v) => !v)}
              className="cursor-pointer font-medium text-accent-text underline-offset-4 hover:underline"
            >
              {allMatching ? "Select only this page" : `Select all ${total} matching products`}
            </button>
          )}
          {selectedCount > 0 && (
            <span className="text-text-muted">
              {allMatching
                ? `All ${total} matching products selected`
                : `${selectedCount} selected`}
            </span>
          )}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky,40)] border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
            <p className="text-sm font-medium">
              {selectedCount} product{selectedCount === 1 ? "" : "s"} selected
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="gap-1.5"
              >
                <X className="size-4" aria-hidden="true" /> Clear
              </Button>
              <Button type="button" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
                <Percent className="size-4" aria-hidden="true" /> Change prices
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        target={bulkTarget}
        count={selectedCount}
        currency={currency}
        onDone={() => {
          clearSelection();
          router.refresh();
        }}
      />

      <ResponsiveDataTable
        data={items}
        columns={columns}
        keyExtractor={(p) => p.id}
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
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Archive Product"
        description={
          archiveTarget
            ? `Soft-delete and archive "${archiveTarget.name}"? Historical orders referencing its variants remain intact.`
            : ""
        }
        confirmLabel="Archive Product"
        destructive
        loading={archiving}
        onConfirm={handleArchive}
      />

      <ProductDeleteDialog
        target={deleteTarget ? { id: deleteTarget.id, name: deleteTarget.name } : null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => router.refresh()}
        onArchived={() => router.refresh()}
      />
    </div>
  );
}
