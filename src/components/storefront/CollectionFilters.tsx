"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  CollectionFacetsSummary,
  CollectionSortOption,
  FilterBucketOption,
} from "@/modules/catalog/catalog.public";

interface CategoryLinkItem {
  name: string;
  path: string;
  productCount: number;
}

interface CollectionFiltersProps {
  facets: CollectionFacetsSummary;
  totalCount: number;
  currentSort: CollectionSortOption;
  subcategories?: CategoryLinkItem[];
  children: React.ReactNode;
}

const MULTI_FILTER_KEYS = [
  "metal",
  "shape",
  "origin",
  "color",
  "clarity",
  "certification",
] as const;

type MultiFilterKey = (typeof MULTI_FILTER_KEYS)[number];

const SORT_LABELS: Record<CollectionSortOption, string> = {
  featured: "Curated & Featured",
  newest: "Newest Arrivals",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "carat-desc": "Carat: High to Low",
};

export function CollectionFilters({
  facets,
  totalCount,
  currentSort,
  subcategories = [],
  children,
}: CollectionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const rangeMinPrice = searchParams.get("minPrice") ?? "";
  const rangeMaxPrice = searchParams.get("maxPrice") ?? "";
  const rangeMinCarat = searchParams.get("minCarat") ?? "";
  const rangeMaxCarat = searchParams.get("maxCarat") ?? "";
  const rangeResetKey = `${rangeMinPrice}|${rangeMaxPrice}|${rangeMinCarat}|${rangeMaxCarat}`;

  function pushParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleMultiValue(key: MultiFilterKey, value: string) {
    pushParams((next) => {
      const existing = next.getAll(key);
      if (existing.includes(value)) {
        const remaining = existing.filter((item) => item !== value);
        next.delete(key);
        remaining.forEach((item) => next.append(key, item));
      } else {
        next.append(key, value);
      }
    });
  }

  function clearAllFilters() {
    pushParams((next) => {
      for (const key of [
        ...MULTI_FILTER_KEYS,
        "minPrice",
        "maxPrice",
        "minCarat",
        "maxCarat",
        "inStock",
      ]) {
        next.delete(key);
      }
    });
  }

  function applyRangeFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const minPriceVal = String(formData.get("minPrice") ?? "").trim();
    const maxPriceVal = String(formData.get("maxPrice") ?? "").trim();
    const minCaratVal = String(formData.get("minCarat") ?? "").trim();
    const maxCaratVal = String(formData.get("maxCarat") ?? "").trim();

    pushParams((next) => {
      if (minPriceVal) next.set("minPrice", minPriceVal);
      else next.delete("minPrice");
      if (maxPriceVal) next.set("maxPrice", maxPriceVal);
      else next.delete("maxPrice");
      if (minCaratVal) next.set("minCarat", minCaratVal);
      else next.delete("minCarat");
      if (maxCaratVal) next.set("maxCarat", maxCaratVal);
      else next.delete("maxCarat");
    });
    setMobileOpen(false);
  }

  const activeChips: Array<{ label: string; onRemove: () => void }> = [];
  for (const key of MULTI_FILTER_KEYS) {
    for (const val of searchParams.getAll(key)) {
      activeChips.push({
        label: val,
        onRemove: () => toggleMultiValue(key, val),
      });
    }
  }
  if (searchParams.get("inStock") === "1") {
    activeChips.push({
      label: "Ready to Ship",
      onRemove: () => pushParams((next) => next.delete("inStock")),
    });
  }
  if (searchParams.get("minPrice") || searchParams.get("maxPrice")) {
    activeChips.push({
      label: `Price: ${searchParams.get("minPrice") ?? "0"}–${searchParams.get("maxPrice") ?? "Any"}`,
      onRemove: () =>
        pushParams((next) => {
          next.delete("minPrice");
          next.delete("maxPrice");
        }),
    });
  }
  if (searchParams.get("minCarat") || searchParams.get("maxCarat")) {
    activeChips.push({
      label: `Carat: ${searchParams.get("minCarat") ?? "0"}–${searchParams.get("maxCarat") ?? "Any"} ct`,
      onRemove: () =>
        pushParams((next) => {
          next.delete("minCarat");
          next.delete("maxCarat");
        }),
    });
  }

  function renderBucketSection(
    prefix: string,
    title: string,
    key: MultiFilterKey,
    options: FilterBucketOption[],
  ) {
    if (options.length === 0) return null;
    const selected = searchParams.getAll(key);

    return (
      <fieldset className="border-b border-border/80 pb-4">
        <legend className="mb-2.5 text-xs font-medium tracking-[0.1em] text-foreground uppercase">
          {title}
        </legend>
        <div className="space-y-2">
          {options.map((opt) => {
            const id = `${prefix}-${key}-${opt.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            const checked = selected.includes(opt.value);
            return (
              <div key={opt.value} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggleMultiValue(key, opt.value)}
                  />
                  <Label
                    htmlFor={id}
                    className="cursor-pointer text-sm font-normal text-foreground"
                  >
                    {opt.label}
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums-price">
                  {opt.count}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  }

  function renderFilterSidebarBody(prefix: string) {
    return (
      <div className="space-y-5">
        {subcategories.length > 0 && (
          <div className="border-b border-border/80 pb-4">
            <p className="mb-2.5 text-xs font-medium tracking-[0.1em] text-foreground uppercase">
              Categories
            </p>
            <ul className="space-y-1.5 text-sm">
              {subcategories.map((sub) => (
                <li key={sub.path}>
                  <Link
                    href={`/collections/${sub.path}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between py-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>{sub.name}</span>
                    <span className="text-xs tabular-nums-price">{sub.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <Label htmlFor={`${prefix}-in-stock`} className="cursor-pointer text-sm font-medium">
            In Stock &amp; Ready to Ship
          </Label>
          <Checkbox
            id={`${prefix}-in-stock`}
            checked={searchParams.get("inStock") === "1"}
            onCheckedChange={(checked) =>
              pushParams((next) => {
                if (checked) next.set("inStock", "1");
                else next.delete("inStock");
              })
            }
          />
        </div>

        {renderBucketSection(prefix, "Metal", "metal", facets.metals)}
        {renderBucketSection(prefix, "Diamond Shape", "shape", facets.shapes)}
        {renderBucketSection(prefix, "Stone Origin", "origin", facets.origins)}
        {renderBucketSection(prefix, "Colour Grade", "color", facets.colors)}
        {renderBucketSection(prefix, "Clarity", "clarity", facets.clarities)}
        {renderBucketSection(prefix, "Certification", "certification", facets.certifications)}

        <form key={rangeResetKey} onSubmit={applyRangeFilters} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium tracking-[0.1em] text-foreground uppercase">
              Price Range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`${prefix}-min-price`} className="sr-only">
                  Minimum price
                </Label>
                <Input
                  id={`${prefix}-min-price`}
                  name="minPrice"
                  type="number"
                  min={0}
                  placeholder={`Min (${facets.priceBounds.min})`}
                  defaultValue={rangeMinPrice}
                />
              </div>
              <div>
                <Label htmlFor={`${prefix}-max-price`} className="sr-only">
                  Maximum price
                </Label>
                <Input
                  id={`${prefix}-max-price`}
                  name="maxPrice"
                  type="number"
                  min={0}
                  placeholder={`Max (${facets.priceBounds.max})`}
                  defaultValue={rangeMaxPrice}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-[0.1em] text-foreground uppercase">
              Carat Weight
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`${prefix}-min-carat`} className="sr-only">
                  Minimum carat
                </Label>
                <Input
                  id={`${prefix}-min-carat`}
                  name="minCarat"
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder={`Min (${facets.caratBounds.min})`}
                  defaultValue={rangeMinCarat}
                />
              </div>
              <div>
                <Label htmlFor={`${prefix}-max-carat`} className="sr-only">
                  Maximum carat
                </Label>
                <Input
                  id={`${prefix}-max-carat`}
                  name="maxCarat"
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder={`Max (${facets.caratBounds.max})`}
                  defaultValue={rangeMaxCarat}
                />
              </div>
            </div>
          </div>

          <Button type="submit" variant="outline" className="w-full">
            Apply Ranges
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <aside aria-label="Collection filters" className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24 rounded-md border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-sans text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
              Refine Selection
            </h2>
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="cursor-pointer text-xs font-medium text-accent-text hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          {renderFilterSidebarBody("desktop-filter")}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 lg:hidden">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  <span>Filter{activeChips.length > 0 ? ` (${activeChips.length})` : ""}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(90vw,22rem)] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Refine Selection</SheetTitle>
                  <SheetDescription>
                    Filter creations by metal, diamond shape, grading, and price.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5">
                  {activeChips.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="mb-4 text-accent-text"
                    >
                      Clear all filters
                    </Button>
                  )}
                  {renderFilterSidebarBody("mobile-filter")}
                </div>
              </SheetContent>
            </Sheet>

            <p className="text-sm text-muted-foreground tabular-nums-price">
              <strong className="font-medium text-foreground">{totalCount}</strong>{" "}
              {totalCount === 1 ? "piece" : "pieces"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="collection-sort-select" className="text-xs text-muted-foreground">
              Sort
            </Label>
            <Select
              value={currentSort}
              onValueChange={(value) =>
                pushParams((next) => {
                  next.set("sort", value);
                })
              }
            >
              <SelectTrigger id="collection-sort-select" className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as CollectionSortOption[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <Badge key={chip.label} variant="default" className="gap-1.5 py-1 pr-1.5 pl-2.5">
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remove filter ${chip.label}`}
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-background"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
