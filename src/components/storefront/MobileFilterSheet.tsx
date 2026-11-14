"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CollectionSortOption } from "@/modules/catalog/catalog.public";

interface MobileFilterSheetProps {
  activeCount: number;
  totalCount: number;
  onClearAll: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function MobileFilterSheet({
  activeCount,
  totalCount,
  onClearAll,
  disabled = false,
  children,
}: MobileFilterSheetProps) {
  const ui = useUiText();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-11 min-w-0 flex-1 justify-center gap-1.5 px-2.5 sm:gap-2 sm:px-3"
        >
          <SlidersHorizontal className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{ui.collections.filters.heading}</span>
          {activeCount > 0 && (
            <span className="tabular-nums-price inline-flex min-w-5 items-center justify-center rounded-full bg-accent-tint px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showDragHandle
        className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[20px] p-0 pb-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 pt-1 pr-14 pb-3 sm:px-5 sm:pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-display text-base font-semibold text-text">
              {ui.collections.filters.heading}
            </SheetTitle>
            {activeCount > 0 && (
              <span className="tabular-nums-price inline-flex min-w-5 items-center justify-center rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-text">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex min-h-11 cursor-pointer items-center px-2 text-xs font-medium text-accent-text hover:text-accent-hover hover:underline"
            >
              {ui.collections.filters.clearAll}
            </button>
          )}
          <SheetDescription className="sr-only">
            {ui.collections.filters.mobileDescription}
          </SheetDescription>
        </div>

        <div className="drawer-scroll flex-1 overflow-y-auto px-4 py-1 sm:px-5">{children}</div>

        <div className="flex shrink-0 items-center gap-2.5 border-t border-border bg-popover px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:gap-3 sm:px-5 sm:py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="h-12 flex-1"
          >
            {ui.collections.filters.clear}
          </Button>
          <Button type="button" onClick={() => setOpen(false)} className="h-12 flex-[2] gap-1">
            <span>{ui.collections.filters.show}</span>
            <AnimatedCounter value={totalCount} />
            <span>
              {totalCount === 1 ? ui.collections.filters.result : ui.collections.filters.results}
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MobileSortSheetProps {
  currentSort: CollectionSortOption;
  sortOptions: Array<{ value: CollectionSortOption; label: string }>;
  onSelectSort: (value: CollectionSortOption) => void;
  disabled?: boolean;
}

export function MobileSortSheet({
  currentSort,
  sortOptions,
  onSelectSort,
  disabled = false,
}: MobileSortSheetProps) {
  const ui = useUiText();
  const [open, setOpen] = React.useState(false);
  const currentSortLabel = sortOptions.find((opt) => opt.value === currentSort)?.label;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-11 min-w-0 flex-1 justify-center gap-1.5 px-2.5 sm:gap-2 sm:px-3"
        >
          <ArrowUpDown className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">
            {currentSort !== "featured" && currentSortLabel
              ? currentSortLabel
              : ui.collections.filters.sort}
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showDragHandle
        className="flex max-h-[75dvh] flex-col gap-0 overflow-hidden rounded-t-[20px] p-0 pb-0"
      >
        <div className="flex shrink-0 items-center border-b border-border px-4 pt-1 pr-14 pb-3 sm:px-5 sm:pr-14">
          <SheetTitle className="font-display text-base font-semibold text-text">
            {ui.collections.filters.sortBy}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {ui.collections.filters.sortDescription}
          </SheetDescription>
        </div>

        <div className="overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-5">
          <RadioGroup
            value={currentSort}
            onValueChange={(value) => {
              onSelectSort(value as CollectionSortOption);
              setOpen(false);
            }}
            className="gap-1"
          >
            {sortOptions.map((option) => (
              <label
                key={option.value}
                htmlFor={`mobile-sort-${option.value}`}
                className="flex min-h-12 cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-3"
              >
                <span>{option.label}</span>
                <RadioGroupItem id={`mobile-sort-${option.value}`} value={option.value} />
              </label>
            ))}
          </RadioGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
