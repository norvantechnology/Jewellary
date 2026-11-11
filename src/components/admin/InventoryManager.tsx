"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, PlusCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Pagination } from "@/components/shared/Pagination";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { adjustStockAction } from "@/modules/catalog/catalog.actions";
import type {
  AdminInventoryRowDTO,
  InventoryTransactionDTO,
} from "@/modules/catalog/catalog.service";

export function InventoryManager({
  variants,
  transactions,
  total,
  page,
  totalPages,
  initialSearch,
  initialLowStock,
}: {
  variants: AdminInventoryRowDTO[];
  transactions: InventoryTransactionDTO[];
  total: number;
  page: number;
  totalPages: number;
  initialSearch: string;
  initialLowStock: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [onlyLowStock, setOnlyLowStock] = React.useState(initialLowStock);

  const [adjustTarget, setAdjustTarget] = React.useState<AdminInventoryRowDTO | null>(null);
  const [reason, setReason] = React.useState<"RESTOCK" | "ADJUSTMENT" | "RETURN" | "RELEASE">(
    "RESTOCK",
  );
  const [delta, setDelta] = React.useState("1");
  const [note, setNote] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  function buildHref(nextPage: number, nextSearch = search, nextLow = onlyLowStock) {
    const sp = new URLSearchParams();
    if (nextSearch.trim()) sp.set("q", nextSearch.trim());
    if (nextLow) sp.set("lowStock", "1");
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(1));
  }

  function openAdjustModal(row: AdminInventoryRowDTO) {
    setAdjustTarget(row);
    setReason("RESTOCK");
    setDelta("1");
    setNote("");
    setFieldErrors({});
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    setSaving(true);
    setFieldErrors({});

    const res = await adjustStockAction({
      variantId: adjustTarget.id,
      reason,
      delta: Number(delta || "0"),
      note,
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      return;
    }

    toast.success(
      `Updated ${adjustTarget.sku}: on-hand ${res.data.stockQty}, available ${res.data.availableQty}.`,
    );
    setAdjustTarget(null);
    router.refresh();
  }

  const stockColumns: ResponsiveColumn<AdminInventoryRowDTO>[] = [
    {
      key: "sku",
      header: "Variant",
      cell: (v) => (
        <div>
          <Link
            href={`/admin/products/${v.productId}`}
            className="font-medium text-foreground hover:text-accent-text hover:underline"
          >
            {v.productName}
          </Link>
          <p className="text-xs text-muted-foreground">
            {v.title} · <span className="font-mono">{v.sku}</span>
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "On Hand",
      cell: (v) => <span className="tabular-nums-price">{v.stockQty}</span>,
    },
    {
      key: "reserved",
      header: "Reserved",
      cell: (v) => <span className="tabular-nums-price">{v.reservedQty}</span>,
    },
    {
      key: "available",
      header: "Available",
      cell: (v) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums-price">{v.availableQty}</span>
          {v.isLowStock && (
            <Badge variant={v.availableQty <= 0 ? "destructive" : "warning"}>
              <AlertTriangle className="size-3" aria-hidden="true" />
              Low
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (v) => (
        <Button type="button" variant="outline" size="sm" onClick={() => openAdjustModal(v)}>
          <PlusCircle className="size-3.5" aria-hidden="true" />
          <span>Adjust Stock</span>
        </Button>
      ),
    },
  ];

  const ledgerColumns: ResponsiveColumn<InventoryTransactionDTO>[] = [
    {
      key: "sku",
      header: "Piece & SKU",
      cell: (t) => (
        <div>
          <p className="font-medium text-foreground">{t.productName}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {t.variantSku} ({t.variantTitle})
          </p>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (t) => <Badge variant="outline">{t.reason}</Badge>,
    },
    {
      key: "delta",
      header: "Delta",
      cell: (t) => (
        <span
          className={
            t.delta > 0
              ? "font-medium text-success tabular-nums-price"
              : "font-medium text-destructive tabular-nums-price"
          }
        >
          {t.delta > 0 ? `+${t.delta}` : String(t.delta)}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (t) => <span className="tabular-nums-price">{t.balanceAfter}</span>,
    },
    {
      key: "note",
      header: "Audit Note",
      cell: (t) => (
        <div className="max-w-xs">
          <p className="truncate text-sm">{t.note ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {t.actorEmail ?? "System"} · {new Date(t.createdAt).toLocaleString()}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <p className="text-editorial-label text-accent-text">Vault Operations</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
          Inventory &amp; Ledger ({total})
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atomic stock adjustments with reservation guards and an immutable audit ledger.
        </p>
      </div>

      {/* Filters */}
      <form
        onSubmit={applyFilter}
        className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
      >
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Filter inventory by SKU or product title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by product or variant SKU..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="inv-low-only"
            checked={onlyLowStock}
            onCheckedChange={(checked) => {
              setOnlyLowStock(checked);
              router.push(buildHref(1, search, checked));
            }}
          />
          <Label htmlFor="inv-low-only" className="cursor-pointer">
            Low-stock only
          </Label>
        </div>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <section aria-labelledby="vault-stock-heading" className="space-y-3">
        <h2 id="vault-stock-heading" className="font-display text-xl font-medium text-foreground">
          Variant Vault Balances
        </h2>
        <ResponsiveDataTable
          data={variants}
          columns={stockColumns}
          keyExtractor={(v) => v.id}
          mobileTitle={(v) => `${v.productName} — ${v.sku}`}
          emptyState={
            <EmptyState
              icon={Boxes}
              title="No Variants Match Filter"
              description="Try clearing the low-stock toggle or search filter."
            />
          }
        />
        <Pagination currentPage={page} totalPages={totalPages} buildHref={(p) => buildHref(p)} />
      </section>

      <section aria-labelledby="ledger-heading" className="space-y-3">
        <h2 id="ledger-heading" className="font-display text-xl font-medium text-foreground">
          Recent Immutable Stock Ledger
        </h2>
        <ResponsiveDataTable
          data={transactions}
          columns={ledgerColumns}
          keyExtractor={(t) => t.id}
          mobileTitle={(t) => `${t.variantSku} (${t.delta > 0 ? `+${t.delta}` : t.delta})`}
          emptyState={
            <EmptyState
              icon={Boxes}
              title="No Ledger Movements Yet"
              description="Inventory receipts, restocks, and sales appear chronologically here."
            />
          }
        />
      </section>

      <Dialog
        open={Boolean(adjustTarget)}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Vault Stock</DialogTitle>
            <DialogDescription>
              {adjustTarget
                ? `${adjustTarget.productName} (${adjustTarget.sku}) · On-hand ${adjustTarget.stockQty}, Reserved ${adjustTarget.reservedQty}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitAdjustment} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-reason">Movement Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                <SelectTrigger id="adj-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTOCK">Restock (+ addition)</SelectItem>
                  <SelectItem value="ADJUSTMENT">Audit Adjustment (+/-)</SelectItem>
                  <SelectItem value="RETURN">Customer Return</SelectItem>
                  <SelectItem value="RELEASE">Manual Release</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField
              id="adj-delta"
              label="Quantity Delta (positive adds, negative subtracts)"
              required
              error={fieldErrors.delta?.[0]}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField
              id="adj-note"
              label="Audit Reference Note"
              required
              error={fieldErrors.note?.[0]}
            >
              {(aria) => (
                <Input
                  {...aria}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Antwerp parcel intake ref 204"
                  required
                />
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustTarget(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Commit Ledger Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
