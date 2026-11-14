"use client";

import * as React from "react";
import { ArrowRight, Loader2, Percent, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { applyBulkPriceAction, previewBulkPriceAction } from "@/modules/catalog/catalog.actions";

export type BulkPriceTarget =
  | { kind: "ids"; productIds: string[] }
  | {
      kind: "filter";
      filter: {
        search?: string;
        status?: "ALL" | "ACTIVE" | "DRAFT" | "ARCHIVED";
        categoryId?: string;
      };
    };

type Rounding = "cents" | "whole" | "ninety-nine";

interface Preview {
  matched: number;
  updated: number;
  skippedPriceOnRequest: number;
  oldTotal: string;
  newTotal: string;
  preview: Array<{ id: string; name: string; oldPrice: string; newPrice: string }>;
}

const QUICK = [5, 10, 15, 20, 25];
const ROUNDING: Array<{ value: Rounding; label: string; hint: string }> = [
  { value: "cents", label: "Exact", hint: "$412.36" },
  { value: "whole", label: "Whole dollars", hint: "$412" },
  { value: "ninety-nine", label: "End in .99", hint: "$412.99" },
];

export function BulkPriceDialog({
  open,
  onOpenChange,
  target,
  count,
  currency,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: BulkPriceTarget;
  count: number;
  currency: string;
  onDone: () => void;
}) {
  const [direction, setDirection] = React.useState<"increase" | "decrease">("increase");
  const [amount, setAmount] = React.useState("10");
  const [rounding, setRounding] = React.useState<Rounding>("cents");
  const [includeCompareAt, setIncludeCompareAt] = React.useState(true);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const value = Number(amount);
  const valid =
    Number.isFinite(value) && value > 0 && (direction === "increase" ? value <= 500 : value < 90);
  const percent = direction === "increase" ? value : -value;
  const payload = React.useMemo(
    () => ({
      ...(target.kind === "ids" ? { productIds: target.productIds } : { filter: target.filter }),
      percent,
      rounding,
      includeCompareAt,
    }),
    [target, percent, rounding, includeCompareAt],
  );

  // Live preview (debounced) whenever the inputs change.
  React.useEffect(() => {
    if (!open || !valid) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingPreview(true);
      const res = await previewBulkPriceAction(payload);
      if (cancelled) return;
      setLoadingPreview(false);
      if (res.ok) {
        setPreview(res.data);
        setError(null);
      } else {
        setPreview(null);
        setError(res.error.message);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, valid, payload]);

  async function apply() {
    if (!valid || !shown) return;
    setSaving(true);
    const res = await applyBulkPriceAction(payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(
      `Updated ${res.data.updated} product price${res.data.updated === 1 ? "" : "s"} (${percent > 0 ? "+" : ""}${percent}%).`,
    );
    onOpenChange(false);
    onDone();
  }

  const money = (v: string) => formatMoney(v, currency);
  // Hide a stale preview while the percentage is invalid.
  const shown = valid ? preview : null;
  const tooBig = valid && Math.abs(percent) >= 50;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change prices</DialogTitle>
          <DialogDescription>
            {count} product{count === 1 ? "" : "s"} selected. Prices change by a percentage of their
            current price.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div
            role="radiogroup"
            aria-label="Increase or decrease"
            className="grid grid-cols-2 gap-2"
          >
            {(["increase", "decrease"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={direction === d}
                onClick={() => setDirection(d)}
                className={cn(
                  "transition-ui flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium",
                  direction === d
                    ? d === "increase"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-border bg-surface text-text hover:border-border-strong",
                )}
              >
                {d === "increase" ? (
                  <TrendingUp className="size-4" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-4" aria-hidden="true" />
                )}
                {d === "increase" ? "Increase" : "Decrease"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-percent">Percentage</Label>
            <div className="relative">
              <Input
                id="bulk-percent"
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.5}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-10 text-lg font-semibold"
              />
              <Percent
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={cn(
                    "transition-ui min-h-9 cursor-pointer rounded-full border px-3 text-xs font-medium",
                    Number(amount) === q
                      ? "border-accent bg-accent-tint text-text"
                      : "border-border text-text-muted hover:text-text",
                  )}
                >
                  {q}%
                </button>
              ))}
            </div>
            {!valid && (
              <p className="text-xs text-destructive">
                Enter a number above 0 ({direction === "increase" ? "up to 500" : "below 90"}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p id="bulk-rounding" className="text-sm font-medium">
              Rounding
            </p>
            <div
              role="radiogroup"
              aria-labelledby="bulk-rounding"
              className="grid grid-cols-3 gap-2"
            >
              {ROUNDING.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={rounding === r.value}
                  onClick={() => setRounding(r.value)}
                  className={cn(
                    "transition-ui cursor-pointer rounded-lg border px-2 py-2 text-left",
                    rounding === r.value
                      ? "border-accent bg-accent-tint"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-xs text-text-muted">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm">
            <Checkbox
              id="bulk-compare-at"
              checked={includeCompareAt}
              onCheckedChange={(v) => setIncludeCompareAt(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="bulk-compare-at" className="cursor-pointer font-normal">
              <span>
                Also change &ldquo;was&rdquo; (compare-at) prices
                <span className="block text-xs text-text-muted">
                  Keeps sale discounts the same percentage.
                </span>
              </span>
            </Label>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-3" aria-live="polite">
            {loadingPreview && !shown ? (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Calculating…
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : shown ? (
              <div className="space-y-2.5">
                <p className="text-sm font-medium">
                  {shown.updated} price{shown.updated === 1 ? "" : "s"} will change
                  {shown.skippedPriceOnRequest > 0
                    ? ` · ${shown.skippedPriceOnRequest} "price on request" skipped`
                    : ""}
                </p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                  {shown.preview.map((row) => (
                    <li key={row.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-text-muted">{row.name}</span>
                      <span className="text-text-muted tabular-nums line-through">
                        {money(row.oldPrice)}
                      </span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-text-muted"
                        aria-hidden="true"
                      />
                      <span className="font-semibold tabular-nums">{money(row.newPrice)}</span>
                    </li>
                  ))}
                  {shown.updated > shown.preview.length && (
                    <li className="text-xs text-text-muted">
                      …and {shown.updated - shown.preview.length} more
                    </li>
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          {tooBig && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              That&rsquo;s a large change ({percent > 0 ? "+" : ""}
              {percent}%). Double-check before applying.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={apply}
            disabled={!valid || !shown || saving || shown.updated === 0}
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving
              ? "Updating…"
              : shown
                ? `Apply ${percent > 0 ? "+" : ""}${percent}% to ${shown.updated} product${shown.updated === 1 ? "" : "s"}`
                : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
