"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { CollectionFacetsSummary } from "@/modules/catalog/catalog.public";

export type CollectionFacetBucket = CollectionFacetsSummary["metals"][number];

interface RangeFilterControlProps {
  scope: string;
  idPrefix: "price" | "carat";
  minBound: number;
  maxBound: number;
  step: number;
  decimals?: number;
  sliderValue: [number, number];
  inputValues: [string, string];
  placeholderMin: string;
  placeholderMax: string;
  ariaLabelMin: string;
  ariaLabelMax: string;
  sliderAriaLabel: string;
  prefix?: string;
  suffix?: string;
  helperRangeText: string;
  inputMode?: "numeric" | "decimal";
  onInputChange: (next: [string, string]) => void;
  onSliderChange: (next: [number, number]) => void;
  onCommit: (minStr: string, maxStr: string) => void;
}

export function RangeFilterControl({
  scope,
  idPrefix,
  minBound,
  maxBound,
  step,
  decimals = 0,
  sliderValue,
  inputValues,
  placeholderMin,
  placeholderMax,
  ariaLabelMin,
  ariaLabelMax,
  sliderAriaLabel,
  prefix,
  suffix,
  helperRangeText,
  inputMode = "numeric",
  onInputChange,
  onSliderChange,
  onCommit,
}: RangeFilterControlProps) {
  const [validationHint, setValidationHint] = React.useState<string | null>(null);
  const dirtyRef = React.useRef(false);

  const normalizeAndCommit = (rawMin: string, rawMax: string, force = false) => {
    if (!force && !dirtyRef.current) return;
    dirtyRef.current = false;
    const trimmedMin = rawMin.trim();
    const trimmedMax = rawMax.trim();
    const parsedMin = trimmedMin ? Number(trimmedMin) : NaN;
    const parsedMax = trimmedMax ? Number(trimmedMax) : NaN;

    let nextMinNum = Number.isFinite(parsedMin) ? parsedMin : null;
    let nextMaxNum = Number.isFinite(parsedMax) ? parsedMax : null;
    let adjusted = false;

    if (nextMinNum !== null) {
      const clamped = Math.max(minBound, Math.min(maxBound, nextMinNum));
      if (clamped !== nextMinNum) adjusted = true;
      nextMinNum = clamped;
    }

    if (nextMaxNum !== null) {
      const clamped = Math.max(minBound, Math.min(maxBound, nextMaxNum));
      if (clamped !== nextMaxNum) adjusted = true;
      nextMaxNum = clamped;
    }

    if (nextMinNum !== null && nextMaxNum !== null && nextMinNum > nextMaxNum) {
      nextMaxNum = nextMinNum;
      adjusted = true;
    }

    const fmt = (val: number | null, bound: number) => {
      if (val === null) return "";
      const fixed = decimals > 0 ? Number(val.toFixed(decimals)) : Math.round(val);
      if (decimals > 0) {
        return Math.abs(fixed - bound) < 0.001 ? "" : String(fixed);
      }
      return fixed === bound ? "" : String(fixed);
    };

    const nextMinStr = fmt(nextMinNum, minBound);
    const nextMaxStr = fmt(nextMaxNum, maxBound);

    setValidationHint(adjusted ? "Adjusted to valid min ≤ max bounds" : null);
    onInputChange([nextMinStr, nextMaxStr]);
    onCommit(nextMinStr, nextMaxStr);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      normalizeAndCommit(inputValues[0], inputValues[1], true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Label htmlFor={`${scope}-min-${idPrefix}`} className="sr-only">
            {ariaLabelMin}
          </Label>
          <div className="flex h-11 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-tint">
            {prefix && (
              <span aria-hidden="true" className="shrink-0 text-sm text-text-muted">
                {prefix}
              </span>
            )}
            <input
              id={`${scope}-min-${idPrefix}`}
              type="number"
              step={step}
              min={minBound}
              max={maxBound}
              inputMode={inputMode}
              placeholder={placeholderMin}
              aria-label={ariaLabelMin}
              value={inputValues[0]}
              onChange={(e) => {
                dirtyRef.current = true;
                setValidationHint(null);
                onInputChange([e.target.value, inputValues[1]]);
              }}
              onBlur={() => normalizeAndCommit(inputValues[0], inputValues[1])}
              onKeyDown={handleKeyDown}
              className="tabular-nums-price h-full w-full min-w-0 border-0 bg-transparent text-base text-text shadow-none ring-0 outline-none placeholder:text-text-muted focus:ring-0 focus:outline-none focus-visible:outline-none lg:text-sm"
            />
            {suffix && (
              <span aria-hidden="true" className="shrink-0 text-xs text-text-muted">
                {suffix}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <Label htmlFor={`${scope}-max-${idPrefix}`} className="sr-only">
            {ariaLabelMax}
          </Label>
          <div className="flex h-11 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-tint">
            {prefix && (
              <span aria-hidden="true" className="shrink-0 text-sm text-text-muted">
                {prefix}
              </span>
            )}
            <input
              id={`${scope}-max-${idPrefix}`}
              type="number"
              step={step}
              min={minBound}
              max={maxBound}
              inputMode={inputMode}
              placeholder={placeholderMax}
              aria-label={ariaLabelMax}
              value={inputValues[1]}
              onChange={(e) => {
                dirtyRef.current = true;
                setValidationHint(null);
                onInputChange([inputValues[0], e.target.value]);
              }}
              onBlur={() => normalizeAndCommit(inputValues[0], inputValues[1])}
              onKeyDown={handleKeyDown}
              className="tabular-nums-price h-full w-full min-w-0 border-0 bg-transparent text-base text-text shadow-none ring-0 outline-none placeholder:text-text-muted focus:ring-0 focus:outline-none focus-visible:outline-none lg:text-sm"
            />
            {suffix && (
              <span aria-hidden="true" className="shrink-0 text-xs text-text-muted">
                {suffix}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-1 py-2">
        <Slider
          min={minBound}
          max={maxBound}
          step={step}
          thumbAriaLabel={sliderAriaLabel}
          value={sliderValue}
          onValueChange={([nextMin = minBound, nextMax = maxBound]) => {
            setValidationHint(null);
            onSliderChange([nextMin, nextMax]);
          }}
        />
      </div>

      <div className="space-y-1">
        <p className="tabular-nums-price text-xs text-text-muted">{helperRangeText}</p>
        {validationHint && (
          <p role="status" className="text-xs text-warning">
            {validationHint}
          </p>
        )}
      </div>
    </div>
  );
}

interface FacetSearchBoxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function FacetSearchBox({ id, label, value, onChange }: FacetSearchBoxProps) {
  return (
    <div className="mb-2.5 flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-tint">
      <Search className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        Filter {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Filter ${label.toLowerCase()}…`}
        className="h-full w-full min-w-0 border-0 bg-transparent text-base text-text outline-none placeholder:text-text-muted focus:ring-0 focus:outline-none lg:text-sm"
      />
    </div>
  );
}

interface FacetCheckboxListProps {
  scope: string;
  groupId: string;
  groupLabel: string;
  buckets: CollectionFacetBucket[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export function FacetCheckboxList({
  scope,
  groupId,
  groupLabel,
  buckets,
  selectedValues,
  onToggle,
}: FacetCheckboxListProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const hasSearch = buckets.length > 8;
  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter(
      (b) => b.label.toLowerCase().includes(q) || b.value.toLowerCase().includes(q),
    );
  }, [buckets, searchQuery]);

  const showLimit = !searchQuery.trim() && !expanded ? 6 : filtered.length;
  const visible = filtered.slice(0, showLimit);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div>
      {hasSearch && (
        <FacetSearchBox
          id={`${scope}-${groupId}-search`}
          label={groupLabel}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}

      {visible.length === 0 ? (
        <p className="py-2 text-xs text-text-muted">No matching options</p>
      ) : (
        <div className="space-y-0.5">
          {visible.map((bucket) => {
            const id = `${scope}-${groupId}-${bucket.value}`;
            const checked = selectedValues.includes(bucket.value);
            const isDisabled = bucket.count === 0 && !checked;

            return (
              <label
                key={bucket.value}
                htmlFor={id}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 text-sm transition-colors",
                  isDisabled
                    ? "cursor-not-allowed opacity-45"
                    : "cursor-pointer hover:bg-surface-3",
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={isDisabled}
                  onCheckedChange={() => !isDisabled && onToggle(bucket.value)}
                />
                <span className="min-w-0 flex-1 truncate text-text">{bucket.label}</span>
                <span className="tabular-nums-price shrink-0 text-xs text-text-muted">
                  ({bucket.count})
                </span>
              </label>
            );
          })}
        </div>
      )}

      {buckets.length > 6 && !searchQuery.trim() && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1.5 inline-flex min-h-8 cursor-pointer items-center px-1.5 text-xs font-medium text-accent-text hover:text-accent-hover hover:underline"
        >
          {expanded ? "Show less" : `Show more (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

export function FacetChipList({
  scope,
  groupId,
  groupLabel,
  buckets,
  selectedValues,
  onToggle,
}: FacetCheckboxListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const hasSearch = buckets.length > 8;

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter(
      (b) => b.label.toLowerCase().includes(q) || b.value.toLowerCase().includes(q),
    );
  }, [buckets, searchQuery]);

  return (
    <div>
      {hasSearch && (
        <FacetSearchBox
          id={`${scope}-${groupId}-search`}
          label={groupLabel}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}

      {filtered.length === 0 ? (
        <p className="py-2 text-xs text-text-muted">No matching options</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((bucket) => {
            const checked = selectedValues.includes(bucket.value);
            const isDisabled = bucket.count === 0 && !checked;

            return (
              <button
                key={bucket.value}
                type="button"
                aria-pressed={checked}
                disabled={isDisabled}
                onClick={() => onToggle(bucket.value)}
                className={cn(
                  "transition-ui inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45",
                  checked
                    ? "border-[1.5px] border-accent bg-accent-tint font-semibold text-text"
                    : "border-border bg-surface text-text hover:border-border-strong",
                )}
              >
                <span>{bucket.label}</span>
                <span className="tabular-nums-price text-[11px] text-text-muted">
                  ({bucket.count})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
