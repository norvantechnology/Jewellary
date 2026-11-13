"use client";

import * as React from "react";
import Decimal from "decimal.js";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  formatOptionAdjustment,
  type PendingCustomizationUpload,
  type UploadedCustomizationImageItem,
} from "@/components/storefront/customize/types";
import { CUSTOMIZATION_SWATCH_FALLBACK } from "@/lib/customization-swatches";
import { cn } from "@/lib/utils";
import type {
  CustomizationOptionGroupDTO,
  CustomizationOptionValueDTO,
  SubmittedGroupInput,
} from "@/modules/customization/customization.validation";

function useIsDesktopPopover() {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

function getDecimalPlaces(stepStr: string, minStr: string): number {
  const parts = [stepStr, minStr].map((s) => s.trim().split(".")[1]?.length ?? 0);
  return Math.max(0, Math.min(4, ...parts));
}

function buildDescribedBy(ids: Array<string | undefined | null>): string | undefined {
  const active = ids.filter((id): id is string => Boolean(id));
  return active.length > 0 ? active.join(" ") : undefined;
}

/* -------------------------------------------------------------------------- */
/* OptionGroupCards (<= 6 values)                                              */
/* -------------------------------------------------------------------------- */

interface OptionGroupCardsProps {
  group: CustomizationOptionGroupDTO;
  options: CustomizationOptionValueDTO[];
  input: SubmittedGroupInput | undefined;
  error?: string;
  labelId: string;
  helperId?: string;
  errorId?: string;
  variant: "page" | "drawer";
  onChange: (next: SubmittedGroupInput) => void;
}

export function OptionGroupCards({
  group,
  options,
  input,
  error,
  labelId,
  helperId,
  errorId,
  variant,
  onChange,
}: OptionGroupCardsProps) {
  const { formatPrice } = useCurrency();
  const isMulti = group.type === "MULTI_SELECT";
  const cardRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const describedBy = buildDescribedBy([helperId, errorId]);

  const selectedValues = React.useMemo(() => {
    if (isMulti) return new Set(input?.values ?? []);
    return input?.value ? new Set([input.value]) : new Set<string>();
  }, [input, isMulti]);

  function handleSelect(val: string) {
    if (isMulti) {
      const next = new Set(input?.values ?? []);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      onChange({ values: Array.from(next) });
      return;
    }

    if (!group.required && input?.value === val) {
      onChange({ value: "" });
    } else {
      onChange({ value: val });
    }
  }

  function handleRadioKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (isMulti || options.length === 0) return;
    let targetIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      targetIdx = (idx + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      targetIdx = (idx - 1 + options.length) % options.length;
    }
    if (targetIdx === null) return;
    e.preventDefault();
    const targetOption = options[targetIdx];
    if (targetOption) {
      onChange({ value: targetOption.value });
      cardRefs.current[targetIdx]?.focus();
    }
  }

  const hasLongLabel = options.some((opt) => opt.label.trim().length > 12);
  const hasAnyAdjustment = options.some((opt) => Boolean(formatOptionAdjustment(opt, formatPrice)));

  const gridColsClass =
    variant === "drawer"
      ? hasLongLabel
        ? "grid-cols-1 min-[400px]:grid-cols-2"
        : "grid-cols-2"
      : cn(
          hasLongLabel ? "grid-cols-1" : "grid-cols-2",
          options.length === 2
            ? "min-[400px]:grid-cols-2"
            : "min-[400px]:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]",
        );

  const showSwatchDot = group.type === "SWATCH" || options.some((opt) => Boolean(opt.swatchHex));

  return (
    <div
      role={isMulti ? "group" : "radiogroup"}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-required={group.required || undefined}
      aria-invalid={Boolean(error) || undefined}
      className={cn("grid auto-rows-fr gap-2.5", gridColsClass)}
    >
      {options.map((opt, idx) => {
        const selected = selectedValues.has(opt.value);
        const adj = formatOptionAdjustment(opt, formatPrice);
        const tabIndex = isMulti ? 0 : selected || (!input?.value && idx === 0) ? 0 : -1;

        return (
          <button
            key={opt.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            type="button"
            disabled={!opt.isAvailable}
            role={isMulti ? "checkbox" : "radio"}
            aria-checked={selected}
            tabIndex={tabIndex}
            data-testid={`option-card-${group.code}-${opt.value}`}
            onClick={() => handleSelect(opt.value)}
            onKeyDown={(e) => handleRadioKeyDown(e, idx)}
            className={cn(
              "transition-ui group relative flex min-h-16 items-start justify-between gap-2 rounded-xl px-3.5 py-3 text-left focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-[1.5px] border-accent bg-accent/[0.08]"
                : error
                  ? "border border-destructive/60 bg-surface hover:border-destructive/80"
                  : "border border-border bg-surface hover:border-border-strong hover:bg-surface-2",
            )}
          >
            <span className="flex min-w-0 flex-1 items-start gap-2">
              {showSwatchDot ? (
                <span
                  aria-hidden="true"
                  className="mt-[2px] size-4 shrink-0 rounded-full border border-foreground/15 shadow-inner"
                  style={{ backgroundColor: opt.swatchHex ?? CUSTOMIZATION_SWATCH_FALLBACK }}
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[15px] leading-[1.3] font-medium [overflow-wrap:break-word] [word-break:normal] [hyphens:none] text-foreground">
                  {opt.label}
                </span>
                {hasAnyAdjustment ? (
                  <span
                    aria-hidden={!adj || undefined}
                    className="tabular-nums-price mt-0.5 block min-h-[17px] text-[13px] leading-[1.3] text-muted-foreground"
                  >
                    {adj ?? "\u00A0"}
                  </span>
                ) : null}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center self-center"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center border transition-colors",
                  isMulti ? "rounded-md" : "rounded-full",
                  selected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border-strong bg-background",
                )}
              >
                {selected ? <Check className="size-3 stroke-[2.5]" /> : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionGroupSearchSelect (> 6 values)                                        */
/* -------------------------------------------------------------------------- */

interface OptionGroupSearchSelectProps {
  group: CustomizationOptionGroupDTO;
  options: CustomizationOptionValueDTO[];
  input: SubmittedGroupInput | undefined;
  error?: string;
  labelId: string;
  helperId?: string;
  errorId?: string;
  inModal?: boolean;
  onChange: (next: SubmittedGroupInput) => void;
}

export function OptionGroupSearchSelect({
  group,
  options,
  input,
  error,
  labelId,
  helperId,
  errorId,
  inModal = false,
  onChange,
}: OptionGroupSearchSelectProps) {
  const { formatPrice } = useCurrency();
  const isDesktop = useIsDesktopPopover();
  const isMulti = group.type === "MULTI_SELECT";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const describedBy = buildDescribedBy([helperId, errorId]);

  const selectedSet = React.useMemo(() => {
    if (isMulti) return new Set(input?.values ?? []);
    return input?.value ? new Set([input.value]) : new Set<string>();
  }, [input, isMulti]);

  const selectedOptions = React.useMemo(
    () => options.filter((opt) => selectedSet.has(opt.value)),
    [options, selectedSet],
  );

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setActiveIndex(0);
    if (!nextOpen) {
      setQuery("");
    }
  }

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(0);
  }

  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  function handleChoose(optValue: string) {
    if (isMulti) {
      const next = new Set(input?.values ?? []);
      if (next.has(optValue)) {
        next.delete(optValue);
      } else {
        next.add(optValue);
      }
      onChange({ values: Array.from(next) });
      return;
    }

    if (!group.required && input?.value === optValue) {
      onChange({ value: "" });
    } else {
      onChange({ value: optValue });
    }
    handleOpenChange(false);
  }

  function handleClear() {
    onChange(isMulti ? { values: [] } : { value: "" });
    if (!isMulti) handleOpenChange(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filteredOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => (idx + 1) % filteredOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => (idx - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === "Enter") {
      const opt = filteredOptions[activeIndex];
      if (opt) {
        e.preventDefault();
        handleChoose(opt.value);
      }
    }
  }

  const triggerText =
    selectedOptions.length === 0
      ? group.placeholder || `Choose ${group.label.toLowerCase()}`
      : isMulti
        ? selectedOptions.length <= 2
          ? selectedOptions.map((o) => o.label).join(", ")
          : `${selectedOptions.length} selected (${selectedOptions[0]!.label}…)`
        : selectedOptions[0]!.label;

  const showSwatchDot = group.type === "SWATCH" || options.some((opt) => Boolean(opt.swatchHex));

  const listboxContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2.5">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={`Search ${group.label.toLowerCase()}...`}
            aria-label={`Search ${group.label}`}
            className="h-11 pr-9 pl-9 text-base sm:h-9 sm:text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              aria-label="Clear search"
              className="absolute right-1.5 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        role="listbox"
        aria-labelledby={labelId}
        aria-multiselectable={isMulti || undefined}
        className="max-h-64 min-h-0 flex-1 overflow-y-auto p-1.5 sm:max-h-60"
      >
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No options match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = selectedSet.has(opt.value);
            const adj = formatOptionAdjustment(opt, formatPrice);
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleChoose(opt.value)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  idx === activeIndex ? "bg-surface-3" : "hover:bg-surface-2",
                  isSelected && "bg-accent-tint font-medium text-text",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  {showSwatchDot ? (
                    <span
                      aria-hidden="true"
                      className="size-4 shrink-0 rounded-full border border-foreground/15"
                      style={{ backgroundColor: opt.swatchHex ?? CUSTOMIZATION_SWATCH_FALLBACK }}
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{opt.label}</span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {adj ? (
                    <span className="tabular-nums-price text-xs text-muted-foreground">{adj}</span>
                  ) : null}
                  {isSelected ? (
                    <Check className="size-4 text-accent-text" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {(!group.required && selectedOptions.length > 0) || (isMulti && !isDesktop) ? (
        <div className="safe-area-pb flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
          {!group.required && selectedOptions.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-9 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear selection
            </button>
          ) : (
            <span />
          )}
          {isMulti || !isDesktop ? (
            <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const triggerButton = (
    <button
      type="button"
      data-testid={`option-select-trigger-${group.code}`}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={!isDesktop ? () => handleOpenChange(true) : undefined}
      className={cn(
        "transition-ui flex h-12 w-full items-center justify-between gap-2.5 rounded-xl border bg-card px-3.5 text-left text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
        error ? "border-destructive text-text" : "border-border-strong hover:border-accent",
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {!isMulti && selectedOptions[0]?.swatchHex ? (
          <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full border border-foreground/15"
            style={{ backgroundColor: selectedOptions[0].swatchHex }}
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 truncate",
            selectedOptions.length === 0 ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {triggerText}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {!isMulti && selectedOptions[0]
          ? (() => {
              const adj = formatOptionAdjustment(selectedOptions[0]!, formatPrice);
              return adj ? (
                <span className="tabular-nums-price text-xs text-muted-foreground">{adj}</span>
              ) : null;
            })()
          : null}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
    </button>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          portalled={!inModal}
          align="start"
          sideOffset={6}
          className="w-[var(--radix-popover-trigger-width)] max-w-[min(420px,calc(100vw-2rem))] min-w-[260px] p-0"
        >
          {listboxContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {triggerButton}
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showDragHandle
          className="flex max-h-[82dvh] w-full flex-col gap-0 p-0 pb-0"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">{group.label}</SheetTitle>
          </SheetHeader>
          {listboxContent}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionGroupNumeric (Slider + [ - ] [ value ] [ + ] unit stepper)           */
/* -------------------------------------------------------------------------- */

interface OptionGroupNumericProps {
  group: CustomizationOptionGroupDTO;
  input: SubmittedGroupInput | undefined;
  error?: string;
  labelId: string;
  helperId?: string;
  errorId?: string;
  onChange: (next: SubmittedGroupInput) => void;
}

export function OptionGroupNumeric({
  group,
  input,
  error,
  labelId,
  helperId,
  errorId,
  onChange,
}: OptionGroupNumericProps) {
  const minVal = group.minValue !== null ? Number(group.minValue) : 0;
  const maxVal = group.maxValue !== null ? Number(group.maxValue) : 100;
  const stepVal =
    group.stepValue !== null && Number(group.stepValue) > 0 ? Number(group.stepValue) : 0.25;
  const decimals = getDecimalPlaces(String(stepVal), String(minVal));
  const rawStr = String(input?.numberValue ?? input?.value ?? group.defaultValue ?? minVal);
  const parsedVal = Number.isFinite(Number(rawStr)) ? Number(rawStr) : minVal;
  const clampedSliderVal = Math.min(maxVal, Math.max(minVal, parsedVal));

  const trimmed = rawStr.trim();
  const numericCandidate = trimmed === "" ? Number.NaN : Number(trimmed);
  const isOutOfRange =
    trimmed !== "" &&
    (!Number.isFinite(numericCandidate) || numericCandidate < minVal || numericCandidate > maxVal);
  const rangeHintId = isOutOfRange ? `${group.code}-range-hint` : undefined;
  const effectiveDescribedBy = buildDescribedBy([helperId, errorId, rangeHintId]);

  function applyStep(deltaSign: -1 | 1) {
    try {
      const current = new Decimal(Number.isFinite(parsedVal) ? parsedVal : minVal);
      const next = current.plus(new Decimal(stepVal).times(deltaSign));
      const bounded = Decimal.min(new Decimal(maxVal), Decimal.max(new Decimal(minVal), next));
      onChange({ numberValue: bounded.toDecimalPlaces(decimals).toString() });
    } catch {
      onChange({ numberValue: String(minVal) });
    }
  }

  function clampAndNormalize(raw: string) {
    const val = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(val)) {
      const fallback =
        group.defaultValue !== null && Number.isFinite(Number(group.defaultValue))
          ? Number(group.defaultValue)
          : minVal;
      onChange({ numberValue: new Decimal(fallback).toDecimalPlaces(decimals).toString() });
      return;
    }
    try {
      const bounded = Decimal.min(
        new Decimal(maxVal),
        Decimal.max(new Decimal(minVal), new Decimal(val)),
      );
      const stepsFromMin = bounded
        .minus(minVal)
        .dividedBy(stepVal)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      const snapped = Decimal.min(
        new Decimal(maxVal),
        Decimal.max(new Decimal(minVal), new Decimal(minVal).plus(stepsFromMin.times(stepVal))),
      );
      onChange({ numberValue: snapped.toDecimalPlaces(decimals).toString() });
    } catch {
      onChange({ numberValue: String(minVal) });
    }
  }

  return (
    <div className="space-y-3">
      {/* Current value always visible while dragging slider */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular-nums-price text-[15px] font-semibold text-foreground">
          {clampedSliderVal}
          {group.unit ? ` ${group.unit}` : ""}
        </span>
      </div>

      <div>
        <Slider
          min={minVal}
          max={maxVal}
          step={stepVal}
          value={[clampedSliderVal]}
          thumbAriaLabel={group.label}
          onValueChange={(vals) => {
            if (vals[0] !== undefined) {
              onChange({ numberValue: String(vals[0]) });
            }
          }}
        />
        <div className="tabular-nums-price mt-1.5 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span className="whitespace-nowrap">
            {minVal}
            {group.unit ? ` ${group.unit}` : ""}
          </span>
          <span className="whitespace-nowrap">
            {maxVal}
            {group.unit ? ` ${group.unit}` : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 [@media(max-width:339px)]:flex-col [@media(max-width:339px)]:items-start">
        <div
          className={cn(
            "inline-flex h-11 items-stretch overflow-hidden rounded-xl border bg-card",
            error || isOutOfRange ? "border-destructive" : "border-input",
          )}
        >
          <button
            type="button"
            onClick={() => applyStep(-1)}
            disabled={parsedVal <= minVal}
            aria-label={`Decrease ${group.label}`}
            className="flex size-11 shrink-0 items-center justify-center border-r border-input text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>

          <input
            type="text"
            inputMode="decimal"
            value={rawStr}
            onChange={(e) => onChange({ numberValue: e.target.value })}
            onBlur={(e) => clampAndNormalize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                applyStep(1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                applyStep(-1);
              }
            }}
            aria-labelledby={labelId}
            aria-describedby={effectiveDescribedBy}
            aria-invalid={Boolean(error || isOutOfRange) || undefined}
            className="tabular-nums-price w-20 bg-transparent px-2 text-center text-base font-medium text-foreground focus:outline-none sm:w-24"
          />

          <button
            type="button"
            onClick={() => applyStep(1)}
            disabled={parsedVal >= maxVal}
            aria-label={`Increase ${group.label}`}
            className="flex size-11 shrink-0 items-center justify-center border-l border-input text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        {group.unit ? (
          <span
            data-testid={`numeric-unit-${group.code}`}
            className="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
          >
            {group.unit}
          </span>
        ) : null}
      </div>

      {isOutOfRange && !error ? (
        <p id={rangeHintId} role="status" className="text-[13px] font-medium text-destructive">
          Enter a value between {minVal} and {maxVal}
          {group.unit ? ` ${group.unit}` : ""} (clamped automatically when done)
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionGroupText (TEXT + TEXTAREA)                                           */
/* -------------------------------------------------------------------------- */

interface OptionGroupTextProps {
  group: CustomizationOptionGroupDTO;
  input: SubmittedGroupInput | undefined;
  error?: string;
  labelId: string;
  helperId?: string;
  errorId?: string;
  onChange: (next: SubmittedGroupInput) => void;
}

export function OptionGroupText({
  group,
  input,
  error,
  labelId,
  helperId,
  errorId,
  onChange,
}: OptionGroupTextProps) {
  const val = input?.textValue ?? input?.value ?? "";
  const maxLen = group.maxLength ?? (group.type === "TEXT" ? 40 : 400);
  const describedBy = buildDescribedBy([helperId, errorId]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || group.type !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, Math.max(88, el.scrollHeight))}px`;
  }, [val, group.type]);

  if (group.type === "TEXTAREA") {
    return (
      <div className="space-y-1.5">
        <Textarea
          ref={textareaRef}
          rows={3}
          maxLength={maxLen}
          value={val}
          placeholder={group.placeholder ?? ""}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => onChange({ textValue: e.target.value })}
          className={cn(
            "min-h-[96px] resize-none rounded-xl text-base",
            error && "border-destructive",
          )}
        />
        <div className="flex items-center justify-end">
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {val.length}/{maxLen}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        maxLength={maxLen}
        value={val}
        placeholder={group.placeholder ?? ""}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => onChange({ textValue: e.target.value })}
        className={cn("h-12 rounded-xl text-base", error && "border-destructive")}
      />
      <div className="flex items-center justify-between gap-3">
        {val.trim() ? (
          <span className="inline-flex max-w-full items-center truncate rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[13px] font-medium tracking-wide text-foreground">
            Preview: {val.trim()}
          </span>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {val.length}/{maxLen}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionGroupImageUpload (Dropzone + thumbnail grid + progress + remove)      */
/* -------------------------------------------------------------------------- */

interface OptionGroupImageUploadProps {
  group: CustomizationOptionGroupDTO;
  images: UploadedCustomizationImageItem[];
  pendingUploads: PendingCustomizationUpload[];
  uploadError: string | null;
  error?: string;
  helperId?: string;
  errorId?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null, maxCap: number) => void;
  onRemoveImage: (storageKey: string) => void;
  onDismissPending: (localId: string) => void;
  onRetryPending: (item: PendingCustomizationUpload) => void;
  onOpenLightbox: (index: number) => void;
}

export function OptionGroupImageUpload({
  group,
  images,
  pendingUploads,
  uploadError,
  error,
  helperId,
  errorId,
  inputRef,
  onFilesSelected,
  onRemoveImage,
  onDismissPending,
  onRetryPending,
  onOpenLightbox,
}: OptionGroupImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const maxCap = Math.min(5, group.maxFiles ?? 5);
  const activeUploadingCount = pendingUploads.filter((p) => p.status === "uploading").length;
  const totalSlotsUsed = images.length + activeUploadingCount;
  const remainingSlots = Math.max(0, maxCap - totalSlotsUsed);
  const describedBy = buildDescribedBy([helperId, errorId]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (remainingSlots <= 0) return;
    onFilesSelected(e.dataTransfer.files, maxCap);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (remainingSlots > 0) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[120px] flex-col justify-center rounded-xl border border-dashed p-4 transition-colors",
          isDragging
            ? "border-accent bg-accent-tint"
            : error
              ? "border-destructive/60 bg-danger-bg/50"
              : "border-border bg-surface-2 hover:border-accent",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[15px] font-medium text-foreground">
              Add reference images ({images.length}/{maxCap})
            </p>
            <p id={helperId} className="text-[13px] text-muted-foreground">
              JPG, PNG or WebP, up to {maxCap} files, 5 MB each
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={remainingSlots <= 0}
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
            className="min-h-11 shrink-0 rounded-xl sm:min-h-10"
          >
            {activeUploadingCount > 0 ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            <span>
              {remainingSlots <= 0
                ? "Maximum uploaded"
                : activeUploadingCount > 0
                  ? "Add more"
                  : "Choose files"}
            </span>
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          aria-label={`Upload reference images for ${group.label}`}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          onChange={(e) => {
            onFilesSelected(e.target.files, maxCap);
            e.target.value = "";
          }}
        />
      </div>

      {/* Live announcement for upload progress / errors */}
      <div aria-live="polite" className="space-y-1">
        {activeUploadingCount > 0 ? (
          <p className="sr-only">
            Uploading {activeUploadingCount} reference{" "}
            {activeUploadingCount === 1 ? "image" : "images"}.
          </p>
        ) : null}
        {uploadError ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{uploadError}</span>
          </p>
        ) : null}
      </div>

      {images.length > 0 || pendingUploads.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {images.map((img, idx) => (
            <div
              key={img.storageKey}
              className="group relative size-[72px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
            >
              <button
                type="button"
                onClick={() => onOpenLightbox(idx)}
                aria-label={`View ${img.originalName ?? `reference image ${idx + 1}`}`}
                className="block size-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumbUrl}
                  alt={img.originalName ?? `Reference image ${idx + 1}`}
                  className="size-full object-cover"
                />
              </button>

              <button
                type="button"
                onClick={() => onRemoveImage(img.storageKey)}
                aria-label={`Remove ${img.originalName ?? `reference image ${idx + 1}`}`}
                className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-footer-bg/85 text-footer-text shadow-sm transition-opacity before:absolute before:-inset-2 before:content-[''] hover:bg-danger hover:text-danger-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}

          {pendingUploads.map((item) => (
            <div
              key={item.localId}
              className="relative size-[72px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className={cn(
                  "size-full object-cover",
                  item.status === "uploading" ? "opacity-60" : "opacity-35",
                )}
              />
              {item.status === "uploading" ? (
                <div className="absolute inset-x-1 bottom-1 space-y-1 rounded bg-footer-bg/90 px-1.5 py-1 text-xs font-medium text-footer-text">
                  <div className="flex items-center justify-between gap-1">
                    <span className="tabular-nums">{item.progress}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-footer-border">
                    <div
                      className="h-full bg-footer-accent transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-footer-bg/85 p-1 text-center text-footer-text">
                  <span className="sr-only">{item.error ?? "Upload failed"}</span>
                  <button
                    type="button"
                    onClick={() => onRetryPending(item)}
                    className="rounded bg-footer-input-bg px-2 py-0.5 text-xs font-medium hover:bg-footer-border"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissPending(item.localId)}
                    aria-label="Dismiss failed upload"
                    className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-footer-input-bg text-footer-text"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionGroup Dispatcher                                                      */
/* -------------------------------------------------------------------------- */

interface OptionGroupProps {
  group: CustomizationOptionGroupDTO;
  input: SubmittedGroupInput | undefined;
  error?: string;
  baseUid: string;
  variant: "page" | "drawer";
  onChange: (next: SubmittedGroupInput) => void;
  // Image upload specific props
  images: UploadedCustomizationImageItem[];
  pendingUploads: PendingCustomizationUpload[];
  uploadError: string | null;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null, maxCap: number) => void;
  onRemoveImage: (storageKey: string) => void;
  onDismissPending: (localId: string) => void;
  onRetryPending: (item: PendingCustomizationUpload) => void;
  onOpenLightbox: (index: number) => void;
}

export function OptionGroup({
  group,
  input,
  error,
  baseUid,
  variant,
  onChange,
  images,
  pendingUploads,
  uploadError,
  uploadInputRef,
  onFilesSelected,
  onRemoveImage,
  onDismissPending,
  onRetryPending,
  onOpenLightbox,
}: OptionGroupProps) {
  const labelId = `${baseUid}-${group.code}-label`;
  const hasSeparateHelper = group.type !== "IMAGE_UPLOAD" && Boolean(group.helperText);
  const helperId =
    group.type === "IMAGE_UPLOAD" || hasSeparateHelper
      ? `${baseUid}-${group.code}-helper`
      : undefined;
  const errorId = error ? `${baseUid}-${group.code}-error` : undefined;

  const availableOptions = React.useMemo(
    () => group.values.filter((v) => v.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder),
    [group.values],
  );

  const isChoiceGroup =
    group.type === "SELECT" || group.type === "SWATCH" || group.type === "MULTI_SELECT";
  const useSearchableSelect = isChoiceGroup && availableOptions.length > 6;

  const useFieldsetCards = isChoiceGroup && !useSearchableSelect;

  const errorBanner = error ? (
    <p
      id={errorId}
      role="alert"
      className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"
    >
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </p>
  ) : null;

  if (useFieldsetCards) {
    return (
      <fieldset
        id={`group-${group.code}`}
        data-group-code={group.code}
        className="m-0 min-w-0 border-0 border-b border-border p-0 pb-6 last:border-b-0 last:pb-0 sm:pb-7"
      >
        <legend className={cn("block w-full p-0", hasSeparateHelper ? "mb-1" : "mb-3")}>
          <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span id={labelId} className="text-base leading-6 font-semibold text-foreground">
              {group.label}
            </span>
            <span className="text-[13px] font-normal text-muted-foreground">
              {group.required ? "Required" : "Optional"}
            </span>
          </span>
        </legend>

        {hasSeparateHelper ? (
          <p id={helperId} className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
            {group.helperText}
          </p>
        ) : null}

        <OptionGroupCards
          group={group}
          options={availableOptions}
          input={input}
          error={error}
          labelId={labelId}
          helperId={helperId}
          errorId={errorId}
          variant={variant}
          onChange={onChange}
        />

        {errorBanner ? <div className="mt-3">{errorBanner}</div> : null}
      </fieldset>
    );
  }

  return (
    <section
      id={`group-${group.code}`}
      data-group-code={group.code}
      aria-labelledby={labelId}
      className="min-w-0 space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0 sm:pb-7"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h2 id={labelId} className="text-base leading-6 font-semibold text-foreground">
            {group.label}
          </h2>
          <span className="text-[13px] font-normal text-muted-foreground">
            {group.required ? "Required" : "Optional"}
          </span>
        </div>

        {hasSeparateHelper ? (
          <p id={helperId} className="text-[13px] leading-relaxed text-muted-foreground">
            {group.helperText}
          </p>
        ) : null}
      </div>

      {useSearchableSelect ? (
        <OptionGroupSearchSelect
          group={group}
          options={availableOptions}
          input={input}
          error={error}
          labelId={labelId}
          helperId={helperId}
          errorId={errorId}
          inModal={variant === "drawer"}
          onChange={onChange}
        />
      ) : null}

      {group.type === "NUMBER_RANGE" ? (
        <OptionGroupNumeric
          group={group}
          input={input}
          error={error}
          labelId={labelId}
          helperId={helperId}
          errorId={errorId}
          onChange={onChange}
        />
      ) : null}

      {group.type === "TEXT" || group.type === "TEXTAREA" ? (
        <OptionGroupText
          group={group}
          input={input}
          error={error}
          labelId={labelId}
          helperId={helperId}
          errorId={errorId}
          onChange={onChange}
        />
      ) : null}

      {group.type === "IMAGE_UPLOAD" ? (
        <OptionGroupImageUpload
          group={group}
          images={images}
          pendingUploads={pendingUploads}
          uploadError={uploadError}
          error={error}
          helperId={helperId}
          errorId={errorId}
          inputRef={uploadInputRef}
          onFilesSelected={onFilesSelected}
          onRemoveImage={onRemoveImage}
          onDismissPending={onDismissPending}
          onRetryPending={onRetryPending}
          onOpenLightbox={onOpenLightbox}
        />
      ) : null}

      {errorBanner}
    </section>
  );
}
