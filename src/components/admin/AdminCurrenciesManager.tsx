"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Edit2, History, Plus, RefreshCw, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPrice,
  type CurrencyRoundingRule,
  type CurrencySymbolPosition,
} from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import {
  createCurrencyAction,
  deleteCurrencyAction,
  updateCurrencyAction,
} from "@/modules/currencies/currency.actions";
import type {
  AdminCurrencyDTO,
  CurrencyRateHistoryDTO,
} from "@/modules/currencies/currency.service";

interface AdminCurrenciesManagerProps {
  currencies: AdminCurrencyDTO[];
  rateHistory: CurrencyRateHistoryDTO[];
}

interface CurrencyFormState {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  symbolPosition: CurrencySymbolPosition;
  decimalPlaces: string;
  roundingRule: CurrencyRoundingRule;
  exchangeRate: string;
  isActive: boolean;
  isDefault: boolean;
  isBase: boolean;
  sortOrder: string;
  note: string;
}

const EMPTY_FORM: CurrencyFormState = {
  code: "",
  name: "",
  symbol: "",
  symbolPosition: "BEFORE",
  decimalPlaces: "2",
  roundingRule: "HALF_UP",
  exchangeRate: "1.00000000",
  isActive: true,
  isDefault: false,
  isBase: false,
  sortOrder: "10",
  note: "",
};

export function AdminCurrenciesManager({ currencies, rateHistory }: AdminCurrenciesManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<CurrencyFormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminCurrencyDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const baseCurrency = React.useMemo(
    () => currencies.find((c) => c.isBase) ?? currencies[0] ?? null,
    [currencies],
  );

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      sortOrder: String(currencies.length),
    });
    setDialogOpen(true);
  }

  function openEdit(c: AdminCurrencyDTO) {
    setForm({
      id: c.id,
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      symbolPosition: c.symbolPosition,
      decimalPlaces: String(c.decimalPlaces),
      roundingRule: c.roundingRule,
      exchangeRate: c.isBase ? "1.00000000" : c.exchangeRate,
      isActive: c.isActive,
      isDefault: c.isDefault,
      isBase: c.isBase,
      sortOrder: String(c.sortOrder),
      note: "",
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const rateNum = Number(form.exchangeRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      toast.error("Exchange rate must be greater than 0.");
      return;
    }
    if (form.isBase && rateNum !== 1) {
      toast.error("Base currency exchange rate must remain equal to 1.");
      return;
    }

    setSaving(true);
    const res = form.id
      ? await updateCurrencyAction({
          id: form.id,
          name: form.name,
          symbol: form.symbol,
          symbolPosition: form.symbolPosition,
          decimalPlaces: Number(form.decimalPlaces),
          roundingRule: form.roundingRule,
          exchangeRate: form.isBase ? "1.00000000" : form.exchangeRate,
          isActive: form.isBase || form.isDefault ? true : form.isActive,
          isDefault: form.isDefault,
          sortOrder: Number(form.sortOrder || "0"),
          note: form.note.trim() || undefined,
        })
      : await createCurrencyAction({
          code: form.code.trim().toUpperCase(),
          name: form.name,
          symbol: form.symbol,
          symbolPosition: form.symbolPosition,
          decimalPlaces: Number(form.decimalPlaces),
          roundingRule: form.roundingRule,
          exchangeRate: form.exchangeRate,
          isActive: form.isDefault ? true : form.isActive,
          isDefault: form.isDefault,
          isBase: false,
          sortOrder: Number(form.sortOrder || "0"),
          note: form.note.trim() || undefined,
        });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    const saved = res.data as AdminCurrencyDTO;
    toast.success(form.id ? `Updated currency ${saved.code}.` : `Added currency ${saved.code}.`);
    setDialogOpen(false);
    router.refresh();
  }

  async function toggleActive(c: AdminCurrencyDTO) {
    if (c.isBase || c.isDefault) {
      toast.error("Base and default currencies must remain active.");
      return;
    }
    setBusyId(c.id);
    const res = await updateCurrencyAction({
      id: c.id,
      isActive: !c.isActive,
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`${c.code} is now ${!c.isActive ? "active" : "inactive"}.`);
    router.refresh();
  }

  async function setAsDefault(c: AdminCurrencyDTO) {
    setBusyId(c.id);
    const res = await updateCurrencyAction({
      id: c.id,
      isActive: true,
      isDefault: true,
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`${c.code} set as storefront default currency.`);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteCurrencyAction({ id: deleteTarget.id });
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`Deleted currency ${deleteTarget.code}.`);
    setDeleteTarget(null);
    router.refresh();
  }

  const previewSample = React.useMemo(() => {
    const rateNum = Number(form.exchangeRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) return "—";
    try {
      return formatPrice("1000.00", {
        code: form.code.trim().toUpperCase() || "USD",
        symbol: form.symbol || "$",
        symbolPosition: form.symbolPosition,
        decimalPlaces: Number(form.decimalPlaces || "2"),
        roundingRule: form.roundingRule,
        exchangeRate: form.exchangeRate || "1",
      });
    } catch {
      return "—";
    }
  }, [form]);

  const currencyColumns: ResponsiveColumn<AdminCurrencyDTO>[] = [
    {
      key: "currency",
      hideOnMobileCard: true,
      header: "Currency",
      cell: (c) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono font-semibold text-foreground">{c.code}</span>
            <span className="text-muted-foreground">({c.symbol})</span>
            {c.isBase && (
              <Badge variant="primary" className="gap-1">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Base (Rate = 1)
              </Badge>
            )}
            {c.isDefault && (
              <Badge variant="success" className="gap-1">
                <Star className="size-3" aria-hidden="true" />
                Default
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{c.name}</p>
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate vs Base",
      cell: (c) => (
        <div className="tabular-nums-price text-sm">
          <p className="font-mono font-medium text-foreground">
            {c.isBase ? "1.00000000" : Number(c.exchangeRate).toFixed(6)}
          </p>
          <p className="text-xs text-muted-foreground">
            1,000 {baseCurrency?.code ?? "USD"} → {formatPrice("1000", c)}
          </p>
        </div>
      ),
    },
    {
      key: "format",
      header: "Formatting",
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          <p>
            {c.decimalPlaces} decimals ·{" "}
            {c.symbolPosition === "BEFORE" ? "Symbol before" : "Symbol after"}
          </p>
          <p>Rule: {c.roundingRule}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status & Order",
      cell: (c) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={c.isActive ? "success" : "default"}>
            {c.isActive ? "Active" : "Inactive"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            Sort #{c.sortOrder} · Updated {formatDate(c.updatedAt)}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (c) => {
        const lockDisable = c.isBase || c.isDefault;
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!c.isDefault && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === c.id}
                onClick={() => void setAsDefault(c)}
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Set Default</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={lockDisable || busyId === c.id}
              onClick={() => void toggleActive(c)}
              title={
                lockDisable
                  ? "Base and default currencies cannot be deactivated."
                  : c.isActive
                    ? "Deactivate currency"
                    : "Activate currency"
              }
            >
              {c.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEdit(c)}
              aria-label={`Edit ${c.code}`}
            >
              <Edit2 className="size-3.5" aria-hidden="true" />
              <span>Edit</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={lockDisable}
              onClick={() => setDeleteTarget(c)}
              aria-label={`Delete currency ${c.code}`}
              title={lockDisable ? "Cannot delete base or default currency." : `Delete ${c.code}`}
            >
              <Trash2
                className={
                  lockDisable ? "size-4 text-muted-foreground/40" : "size-4 text-destructive"
                }
                aria-hidden="true"
              />
            </Button>
          </div>
        );
      },
    },
  ];

  const historyColumns: ResponsiveColumn<CurrencyRateHistoryDTO>[] = [
    {
      key: "time",
      header: "Changed At",
      cell: (h) => <span className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</span>,
    },
    {
      key: "code",
      header: "Currency",
      cell: (h) => (
        <span className="font-mono font-semibold text-foreground">{h.currencyCode}</span>
      ),
    },
    {
      key: "change",
      header: "Old Rate → New Rate",
      cell: (h) => (
        <span className="tabular-nums-price font-mono text-xs text-foreground">
          {Number(h.oldRate).toFixed(6)} → {Number(h.newRate).toFixed(6)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Changed By",
      cell: (h) => (
        <span className="text-xs text-muted-foreground">{h.changedByEmail ?? "System / Seed"}</span>
      ),
    },
    {
      key: "note",
      header: "Reason / Note",
      cell: (h) => <span className="text-xs text-muted-foreground">{h.note ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Multi-Currency &amp; FX</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Currencies &amp; Exchange Rates
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            All catalog product prices remain anchored in base currency{" "}
            <strong className="text-foreground">{baseCurrency?.code ?? "USD"}</strong> (rate = 1).
            Historical orders retain their exact snapshotted rate and totals permanently.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          <span>Add Currency</span>
        </Button>
      </div>

      <Tabs defaultValue="currencies">
        <TabsList>
          <TabsTrigger value="currencies">Configured Currencies ({currencies.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-3.5" aria-hidden="true" />
            <span>Rate Audit History ({rateHistory.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="currencies" className="mt-4">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Currency Matrix</h2>
              <CardDescription>
                Configure display symbols, decimal precision (0 decimals for JPY, 3 decimals for
                KWD), rounding modes, and relative FX rates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveDataTable
                data={currencies}
                columns={currencyColumns}
                keyExtractor={(c) => c.id}
                mobileTitle={(c) => (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">
                      {c.code} · {c.name}
                    </span>
                    <Badge variant={c.isActive ? "success" : "default"}>
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Exchange Rate Audit Log</h2>
              <CardDescription>
                Every manual exchange-rate update records operator attribution, old rate, new rate,
                and timestamp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveDataTable
                data={rateHistory}
                columns={historyColumns}
                keyExtractor={(h) => h.id}
                emptyState={
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No exchange rate changes have been logged yet.
                  </p>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Currency Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? `Edit ${form.code}` : "Add New Currency"}</DialogTitle>
            <DialogDescription>
              Rates are relative to base currency {baseCurrency?.code ?? "USD"} (= 1).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cur-code" label="ISO 4217 Code" required>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.code}
                    disabled={Boolean(form.id)}
                    maxLength={3}
                    placeholder="EUR"
                    className="font-mono uppercase"
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                  />
                )}
              </FormField>
              <FormField id="cur-name" label="Currency Name" required>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.name}
                    placeholder="Euro"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="cur-symbol" label="Display Symbol" required>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.symbol}
                    placeholder="€"
                    maxLength={12}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    required
                  />
                )}
              </FormField>
              <FormField id="cur-pos" label="Symbol Position">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={form.symbolPosition}
                    onChange={(e) =>
                      setForm({ ...form, symbolPosition: e.target.value as CurrencySymbolPosition })
                    }
                  >
                    <option value="BEFORE">Before ($1,000)</option>
                    <option value="AFTER">After (1,000 €)</option>
                  </NativeSelect>
                )}
              </FormField>
              <FormField id="cur-dec" label="Decimal Places (0-4)">
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={0}
                    max={4}
                    value={form.decimalPlaces}
                    onChange={(e) => setForm({ ...form, decimalPlaces: e.target.value })}
                    required
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="cur-rate" label="Exchange Rate vs Base" required>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    disabled={form.isBase}
                    value={form.exchangeRate}
                    onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                    required
                  />
                )}
              </FormField>
              <FormField id="cur-round" label="Rounding Rule">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={form.roundingRule}
                    onChange={(e) =>
                      setForm({ ...form, roundingRule: e.target.value as CurrencyRoundingRule })
                    }
                  >
                    <option value="HALF_UP">Half Up (Standard)</option>
                    <option value="HALF_EVEN">Half Even (Banker)</option>
                    <option value="CEIL">Round Up (Ceil)</option>
                    <option value="FLOOR">Round Down (Floor)</option>
                    <option value="NONE">Minimal Precision</option>
                  </NativeSelect>
                )}
              </FormField>
              <FormField id="cur-sort" label="Sort Order">
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={0}
                    max={999}
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                )}
              </FormField>
            </div>

            <div className="rounded-md border border-border bg-surface-2 px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground">Live Preview (1,000 base): </span>
              <span className="tabular-nums-price font-semibold text-foreground">
                {previewSample}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                <Label htmlFor="cur-active" className="cursor-pointer">
                  Active in Storefront
                </Label>
                <Switch
                  id="cur-active"
                  disabled={form.isBase || form.isDefault}
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                <Label htmlFor="cur-default" className="cursor-pointer">
                  Fallback Default Currency
                </Label>
                <Switch
                  id="cur-default"
                  disabled={form.isDefault}
                  checked={form.isDefault}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      isDefault: checked,
                      isActive: checked ? true : form.isActive,
                    })
                  }
                />
              </div>
            </div>

            <FormField id="cur-note" label="Audit Note (Optional)">
              {(aria) => (
                <Input
                  {...aria}
                  value={form.note}
                  placeholder="e.g. Monthly FX rate sync from ECB reference feed"
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              )}
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} className="gap-1.5">
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span>{form.id ? "Save Currency" : "Create Currency"}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete Currency ${deleteTarget?.code ?? ""}?`}
        description="This removes the currency option from storefront switchers and deletes its FX audit rows. Existing historical orders remain unchanged."
        confirmLabel="Delete Currency"
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
