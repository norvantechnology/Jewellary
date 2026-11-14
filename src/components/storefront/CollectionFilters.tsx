"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { getProductGridClassName } from "@/components/shared/primitives";
import {
  type CollectionFacetBucket,
  FacetCheckboxList,
  FacetChipList,
  RangeFilterControl,
} from "@/components/storefront/FilterControls";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { chipVariants, MOTION_TRANSITIONS, useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  CollectionFacetsSummary,
  CollectionSortOption,
} from "@/modules/catalog/catalog.public";

const LazyMobileFilterSheet = dynamic(
  () => import("@/components/storefront/MobileFilterSheet").then((mod) => mod.MobileFilterSheet),
  { ssr: false },
);

const LazyMobileSortSheet = dynamic(
  () => import("@/components/storefront/MobileFilterSheet").then((mod) => mod.MobileSortSheet),
  { ssr: false },
);

interface CategoryLinkItem {
  id?: string;
  name: string;
  path: string;
  productCount?: number;
}

interface CollectionFiltersProps {
  facets: CollectionFacetsSummary;
  totalCount: number;
  currentSort: CollectionSortOption;
  subcategories?: CategoryLinkItem[];
  errorMessage?: string | null;
  children: React.ReactNode;
}

type ArrayFilterKey = "metal" | "shape" | "origin" | "color" | "clarity" | "certification";

const SORT_VALUES: CollectionSortOption[] = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "carat-desc",
];

const SESSION_OPEN_GROUPS_KEY = "ma_filter_open_groups_v1";
const openGroupsListeners = new Set<() => void>();

function subscribeOpenGroups(listener: () => void) {
  openGroupsListeners.add(listener);
  return () => {
    openGroupsListeners.delete(listener);
  };
}

function getOpenGroupsSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_OPEN_GROUPS_KEY);
  } catch {
    return null;
  }
}

function setOpenGroupsSnapshot(nextGroups: string[]) {
  try {
    window.sessionStorage.setItem(SESSION_OPEN_GROUPS_KEY, JSON.stringify(nextGroups));
  } catch {
    // Ignore unavailable sessionStorage
  }
  for (const listener of openGroupsListeners) {
    listener();
  }
}

function parseNumericParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function GroupHeaderBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular-nums-price inline-flex min-w-5 items-center justify-center rounded-full bg-accent-tint px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">
      {count}
    </span>
  );
}

export function CollectionFilters({
  facets,
  totalCount,
  currentSort,
  subcategories = [],
  errorMessage = null,
  children,
}: CollectionFiltersProps) {
  const ui = useUiText();
  // Labels from site-content.json → ui.collections
  const ARRAY_FILTER_LABELS: Record<ArrayFilterKey, string> = ui.collections.filters.groupLabels;
  const SORT_OPTIONS = SORT_VALUES.map((value) => ({ value, label: ui.collections.sort[value] }));
  const pieceNoun = (count: number) =>
    count === 1 ? ui.collections.filters.piece : ui.collections.filters.pieces;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const reducedMotion = useReducedMotionSafe();
  const { currency, isBaseCurrency, convertFromBase, convertToBase, formatPrice } = useCurrency();

  const priceMinBound = Math.max(0, Math.floor(facets.priceBounds.min));
  const priceMaxBound = Math.max(priceMinBound + 100, Math.ceil(facets.priceBounds.max));
  const caratMinBound = Math.max(0, Number(facets.caratBounds.min.toFixed(2)));
  const caratMaxBound = Math.max(
    Number((caratMinBound + 0.5).toFixed(2)),
    Number(facets.caratBounds.max.toFixed(2)),
  );

  const displayPriceMinBound = React.useMemo(
    () =>
      isBaseCurrency
        ? priceMinBound
        : Math.max(0, Math.floor(Number(convertFromBase(priceMinBound)))),
    [convertFromBase, isBaseCurrency, priceMinBound],
  );
  const displayPriceMaxBound = React.useMemo(
    () =>
      isBaseCurrency
        ? priceMaxBound
        : Math.max(displayPriceMinBound + 10, Math.ceil(Number(convertFromBase(priceMaxBound)))),
    [convertFromBase, displayPriceMinBound, isBaseCurrency, priceMaxBound],
  );
  const priceStep = React.useMemo(
    () =>
      isBaseCurrency
        ? 50
        : Math.max(1, Math.round((displayPriceMaxBound - displayPriceMinBound) / 100)),
    [displayPriceMaxBound, displayPriceMinBound, isBaseCurrency],
  );

  const rawUrlMinPrice = searchParams.get("minPrice");
  const rawUrlMaxPrice = searchParams.get("maxPrice");
  const urlDisplayMinPrice = rawUrlMinPrice
    ? Math.max(
        displayPriceMinBound,
        Math.round(Number(convertFromBase(parseNumericParam(rawUrlMinPrice, priceMinBound)))),
      )
    : displayPriceMinBound;
  const urlDisplayMaxPrice = rawUrlMaxPrice
    ? Math.min(
        displayPriceMaxBound,
        Math.round(Number(convertFromBase(parseNumericParam(rawUrlMaxPrice, priceMaxBound)))),
      )
    : displayPriceMaxBound;
  const urlMinCarat = parseNumericParam(searchParams.get("minCarat"), caratMinBound);
  const urlMaxCarat = parseNumericParam(searchParams.get("maxCarat"), caratMaxBound);

  const urlKey = searchParams.toString();
  const priceDraftKey = `${urlKey}::${currency.code}`;
  const [priceDraft, setPriceDraft] = React.useState<{
    key: string;
    values: [string, string];
  } | null>(null);
  const [caratDraft, setCaratDraft] = React.useState<{
    key: string;
    values: [string, string];
  } | null>(null);

  const priceInputs: [string, string] =
    priceDraft && priceDraft.key === priceDraftKey
      ? priceDraft.values
      : [
          rawUrlMinPrice ? String(urlDisplayMinPrice) : "",
          rawUrlMaxPrice ? String(urlDisplayMaxPrice) : "",
        ];
  const caratInputs: [string, string] =
    caratDraft && caratDraft.key === urlKey
      ? caratDraft.values
      : [searchParams.get("minCarat") ?? "", searchParams.get("maxCarat") ?? ""];

  const setPriceInputs = (values: [string, string]) =>
    setPriceDraft({ key: priceDraftKey, values });
  const setCaratInputs = (values: [string, string]) => setCaratDraft({ key: urlKey, values });

  const priceDebounceRef = React.useRef<number | null>(null);
  const caratDebounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (priceDebounceRef.current !== null) window.clearTimeout(priceDebounceRef.current);
      if (caratDebounceRef.current !== null) window.clearTimeout(caratDebounceRef.current);
    };
  }, []);

  const navigateWithParams = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("page");
      mutate(next);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const inStockOnly = searchParams.get("inStock") === "1";

  const selectedValues = React.useMemo(
    () => ({
      metal: searchParams.getAll("metal"),
      shape: searchParams.getAll("shape"),
      origin: searchParams.getAll("origin"),
      color: searchParams.getAll("color"),
      clarity: searchParams.getAll("clarity"),
      certification: searchParams.getAll("certification"),
    }),
    [searchParams],
  );

  const toggleArrayParam = (key: ArrayFilterKey, value: string) => {
    navigateWithParams((next) => {
      const current = next.getAll(key);
      next.delete(key);
      if (current.includes(value)) {
        for (const item of current) {
          if (item !== value) next.append(key, item);
        }
      } else {
        for (const item of current) next.append(key, item);
        next.append(key, value);
      }
    });
  };

  const commitPriceRange = (minStr: string, maxStr: string) => {
    if (priceDebounceRef.current !== null) {
      window.clearTimeout(priceDebounceRef.current);
    }
    priceDebounceRef.current = window.setTimeout(() => {
      navigateWithParams((next) => {
        const minDisp = minStr.trim() ? Number(minStr) : NaN;
        const maxDisp = maxStr.trim() ? Number(maxStr) : NaN;
        if (Number.isFinite(minDisp) && minDisp > displayPriceMinBound) {
          const baseVal = isBaseCurrency ? minDisp : Number(convertToBase(minDisp));
          if (baseVal > priceMinBound) {
            next.set("minPrice", String(Math.round(baseVal)));
          } else {
            next.delete("minPrice");
          }
        } else {
          next.delete("minPrice");
        }
        if (Number.isFinite(maxDisp) && maxDisp < displayPriceMaxBound) {
          const baseVal = isBaseCurrency ? maxDisp : Number(convertToBase(maxDisp));
          if (baseVal < priceMaxBound) {
            next.set("maxPrice", String(Math.round(baseVal)));
          } else {
            next.delete("maxPrice");
          }
        } else {
          next.delete("maxPrice");
        }
      });
    }, 300);
  };

  const commitCaratRange = (minStr: string, maxStr: string) => {
    if (caratDebounceRef.current !== null) {
      window.clearTimeout(caratDebounceRef.current);
    }
    caratDebounceRef.current = window.setTimeout(() => {
      navigateWithParams((next) => {
        const minNum = minStr.trim() ? Number(minStr) : NaN;
        const maxNum = maxStr.trim() ? Number(maxStr) : NaN;
        if (Number.isFinite(minNum) && minNum > caratMinBound) {
          next.set("minCarat", String(Number(minNum.toFixed(2))));
        } else {
          next.delete("minCarat");
        }
        if (Number.isFinite(maxNum) && maxNum < caratMaxBound) {
          next.set("maxCarat", String(Number(maxNum.toFixed(2))));
        } else {
          next.delete("maxCarat");
        }
      });
    }, 300);
  };

  const clearPendingRangeDebounces = React.useCallback((target?: "price" | "carat") => {
    if ((!target || target === "price") && priceDebounceRef.current !== null) {
      window.clearTimeout(priceDebounceRef.current);
      priceDebounceRef.current = null;
    }
    if ((!target || target === "carat") && caratDebounceRef.current !== null) {
      window.clearTimeout(caratDebounceRef.current);
      caratDebounceRef.current = null;
    }
  }, []);

  const clearAllFilters = () => {
    clearPendingRangeDebounces();
    setPriceDraft(null);
    setCaratDraft(null);
    navigateWithParams((next) => {
      const preservedQ = next.get("q");
      const preservedSort = next.get("sort");
      for (const key of Array.from(next.keys())) {
        next.delete(key);
      }
      if (preservedQ) next.set("q", preservedQ);
      if (preservedSort && preservedSort !== "featured") next.set("sort", preservedSort);
    });
  };

  const clearPriceFilter = () => {
    clearPendingRangeDebounces("price");
    setPriceDraft(null);
    navigateWithParams((next) => {
      next.delete("minPrice");
      next.delete("maxPrice");
    });
  };

  const clearCaratFilter = () => {
    clearPendingRangeDebounces("carat");
    setCaratDraft(null);
    navigateWithParams((next) => {
      next.delete("minCarat");
      next.delete("maxCarat");
    });
  };

  const bucketLookup: Record<ArrayFilterKey, CollectionFacetBucket[]> = {
    metal: facets.metals,
    certification: facets.certifications,
    shape: facets.shapes,
    origin: facets.origins,
    color: facets.colors,
    clarity: facets.clarities,
  };

  type ActiveChip =
    | { id: string; kind: "inStock"; label: string }
    | { id: string; kind: "array"; key: ArrayFilterKey; value: string; label: string }
    | { id: string; kind: "price"; label: string }
    | { id: string; kind: "carat"; label: string };

  const activeChips: ActiveChip[] = [];

  if (inStockOnly) {
    activeChips.push({
      id: "inStock",
      kind: "inStock",
      label: ui.collections.filters.inStockChip,
    });
  }

  for (const key of Object.keys(ARRAY_FILTER_LABELS) as ArrayFilterKey[]) {
    for (const val of selectedValues[key]) {
      const matched = bucketLookup[key].find((b) => b.value === val);
      activeChips.push({
        id: `${key}:${val}`,
        kind: "array",
        key,
        value: val,
        label: matched ? matched.label : val,
      });
    }
  }

  const priceActive = Boolean(rawUrlMinPrice || rawUrlMaxPrice);
  if (priceActive) {
    const minPriceBase = rawUrlMinPrice ?? String(priceMinBound);
    const maxPriceBase = rawUrlMaxPrice ?? String(priceMaxBound);
    activeChips.push({
      id: "price",
      kind: "price",
      label: `${formatPrice(minPriceBase)} – ${formatPrice(maxPriceBase)}`,
    });
  }

  const caratActive = Boolean(searchParams.get("minCarat") || searchParams.get("maxCarat"));
  if (caratActive) {
    const minCaratDisp = searchParams.get("minCarat") ?? caratMinBound.toFixed(2);
    const maxCaratDisp = searchParams.get("maxCarat") ?? caratMaxBound.toFixed(2);
    activeChips.push({
      id: "carat",
      kind: "carat",
      label: `${minCaratDisp} – ${maxCaratDisp} ct`,
    });
  }

  const removeActiveChip = (chip: ActiveChip) => {
    if (chip.kind === "inStock") {
      navigateWithParams((next) => next.delete("inStock"));
    } else if (chip.kind === "array") {
      toggleArrayParam(chip.key, chip.value);
    } else if (chip.kind === "price") {
      clearPriceFilter();
    } else {
      clearCaratFilter();
    }
  };

  const sliderMinPrice = Math.min(
    displayPriceMaxBound,
    Math.max(
      displayPriceMinBound,
      priceInputs[0].trim() ? Number(priceInputs[0]) || displayPriceMinBound : urlDisplayMinPrice,
    ),
  );
  const sliderMaxPrice = Math.max(
    sliderMinPrice,
    Math.min(
      displayPriceMaxBound,
      priceInputs[1].trim() ? Number(priceInputs[1]) || displayPriceMaxBound : urlDisplayMaxPrice,
    ),
  );

  const sliderMinCarat = Math.min(
    caratMaxBound,
    Math.max(
      caratMinBound,
      caratInputs[0].trim() ? Number(caratInputs[0]) || caratMinBound : urlMinCarat,
    ),
  );
  const sliderMaxCarat = Math.max(
    sliderMinCarat,
    Math.min(
      caratMaxBound,
      caratInputs[1].trim() ? Number(caratInputs[1]) || caratMaxBound : urlMaxCarat,
    ),
  );

  const defaultOpenGroups = React.useMemo(
    () => [
      "availability",
      "price",
      ...(caratActive ? ["carat"] : []),
      ...(selectedValues.metal.length > 0 ? ["metal"] : []),
      ...(selectedValues.certification.length > 0 ? ["certification"] : []),
      ...(selectedValues.shape.length > 0 ? ["shape"] : []),
      ...(selectedValues.origin.length > 0 ? ["origin"] : []),
      ...(selectedValues.color.length > 0 ? ["color"] : []),
      ...(selectedValues.clarity.length > 0 ? ["clarity"] : []),
    ],
    [caratActive, selectedValues],
  );

  const savedOpenGroupsRaw = React.useSyncExternalStore(
    subscribeOpenGroups,
    getOpenGroupsSnapshot,
    () => null,
  );

  const openGroups = React.useMemo(() => {
    if (!savedOpenGroupsRaw) return defaultOpenGroups;
    try {
      const parsed = JSON.parse(savedOpenGroupsRaw);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set([
            ...parsed.filter((item): item is string => typeof item === "string"),
            ...defaultOpenGroups.filter((g) => g !== "availability" && g !== "price"),
          ]),
        );
      }
    } catch {
      // Ignore malformed session value
    }
    return defaultOpenGroups;
  }, [defaultOpenGroups, savedOpenGroupsRaw]);

  const handleOpenGroupsChange = React.useCallback((nextGroups: string[]) => {
    setOpenGroupsSnapshot(nextGroups);
  }, []);

  const renderFacetAccordionItem = (
    scope: string,
    groupId: ArrayFilterKey,
    buckets: CollectionFacetBucket[],
    variant: "checkbox" | "chips" = "checkbox",
  ) => {
    if (buckets.length === 0) return null;
    const title = ARRAY_FILTER_LABELS[groupId];
    const selected = selectedValues[groupId];

    return (
      <AccordionItem
        key={groupId}
        value={groupId}
        className="border-b border-border last:border-b-0"
      >
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-2">
            <span>{title}</span>
            <GroupHeaderBadge count={selected.length} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {variant === "chips" ? (
            <FacetChipList
              scope={scope}
              groupId={groupId}
              groupLabel={title}
              buckets={buckets}
              selectedValues={selected}
              onToggle={(val) => toggleArrayParam(groupId, val)}
            />
          ) : (
            <FacetCheckboxList
              scope={scope}
              groupId={groupId}
              groupLabel={title}
              buckets={buckets}
              selectedValues={selected}
              onToggle={(val) => toggleArrayParam(groupId, val)}
            />
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const priceHelperText = `${formatPrice(displayPriceMinBound, { alreadyConverted: true })} – ${formatPrice(displayPriceMaxBound, { alreadyConverted: true })}`;
  const caratHelperText = `${caratMinBound.toFixed(2)} ct – ${caratMaxBound.toFixed(2)} ct`;

  const renderFilterAccordion = (scope: "desktop" | "mobile") => (
    <Accordion
      type="multiple"
      value={openGroups}
      onValueChange={handleOpenGroupsChange}
      className="w-full"
    >
      {/* 1. Availability */}
      <AccordionItem value="availability" className="border-b border-border">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-2">
            <span>{ui.collections.filters.availability}</span>
            <GroupHeaderBadge count={inStockOnly ? 1 : 0} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex min-h-10 items-center justify-between gap-3">
            <Label
              htmlFor={`${scope}-instock`}
              className="cursor-pointer text-sm font-normal text-text"
            >
              {ui.collections.filters.inStockOnly}
            </Label>
            <Switch
              id={`${scope}-instock`}
              checked={inStockOnly}
              onCheckedChange={(checked) =>
                navigateWithParams((next) => {
                  if (checked) next.set("inStock", "1");
                  else next.delete("inStock");
                })
              }
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Price */}
      <AccordionItem value="price" className="border-b border-border">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-2">
            <span>Price ({currency.code})</span>
            <GroupHeaderBadge count={priceActive ? 1 : 0} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <RangeFilterControl
            scope={scope}
            idPrefix="price"
            minBound={displayPriceMinBound}
            maxBound={displayPriceMaxBound}
            step={priceStep}
            decimals={0}
            sliderValue={[sliderMinPrice, sliderMaxPrice]}
            inputValues={priceInputs}
            placeholderMin={String(displayPriceMinBound)}
            placeholderMax={String(displayPriceMaxBound)}
            ariaLabelMin={fill(ui.collections.filters.minPriceAria, { currency: currency.code })}
            ariaLabelMax={fill(ui.collections.filters.maxPriceAria, { currency: currency.code })}
            sliderAriaLabel={ui.collections.filters.priceRangeAria}
            prefix={currency.symbol}
            helperRangeText={priceHelperText}
            inputMode="numeric"
            onInputChange={setPriceInputs}
            onSliderChange={([nextMin, nextMax]) => {
              const minStr = nextMin <= displayPriceMinBound ? "" : String(nextMin);
              const maxStr = nextMax >= displayPriceMaxBound ? "" : String(nextMax);
              setPriceInputs([minStr, maxStr]);
              commitPriceRange(minStr, maxStr);
            }}
            onCommit={commitPriceRange}
          />
        </AccordionContent>
      </AccordionItem>

      {/* 3. Category / Collection (if applicable) */}
      {subcategories.length > 0 && (
        <AccordionItem value="category" className="border-b border-border last:border-b-0">
          <AccordionTrigger className="hover:no-underline">
            {ui.collections.filters.category}
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-0.5">
              {subcategories.map((sub) => (
                <li key={sub.id ?? sub.path}>
                  <Link
                    href={`/collections/${sub.path}`}
                    title={sub.name}
                    className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-1.5 text-sm text-text transition-colors hover:bg-surface-3"
                  >
                    <span className="min-w-0 truncate">{sub.name}</span>
                    {typeof sub.productCount === "number" && (
                      <span className="tabular-nums-price shrink-0 text-xs text-text-muted">
                        ({sub.productCount})
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      )}

      {/* 4. Metal */}
      {renderFacetAccordionItem(scope, "metal", facets.metals, "checkbox")}

      {/* 5. Carat */}
      <AccordionItem value="carat" className="border-b border-border last:border-b-0">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-2">
            <span>{ui.collections.filters.carat}</span>
            <GroupHeaderBadge count={caratActive ? 1 : 0} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <RangeFilterControl
            scope={scope}
            idPrefix="carat"
            minBound={caratMinBound}
            maxBound={caratMaxBound}
            step={0.05}
            decimals={2}
            sliderValue={[sliderMinCarat, sliderMaxCarat]}
            inputValues={caratInputs}
            placeholderMin={caratMinBound.toFixed(2)}
            placeholderMax={caratMaxBound.toFixed(2)}
            ariaLabelMin={ui.collections.filters.minCaratAria}
            ariaLabelMax={ui.collections.filters.maxCaratAria}
            sliderAriaLabel={ui.collections.filters.caratRangeAria}
            suffix="ct"
            helperRangeText={caratHelperText}
            inputMode="decimal"
            onInputChange={setCaratInputs}
            onSliderChange={([nextMin, nextMax]) => {
              const minStr = nextMin <= caratMinBound ? "" : String(Number(nextMin.toFixed(2)));
              const maxStr = nextMax >= caratMaxBound ? "" : String(Number(nextMax.toFixed(2)));
              setCaratInputs([minStr, maxStr]);
              commitCaratRange(minStr, maxStr);
            }}
            onCommit={commitCaratRange}
          />
        </AccordionContent>
      </AccordionItem>

      {/* 6. Diamond shape */}
      {renderFacetAccordionItem(scope, "shape", facets.shapes, "checkbox")}

      {/* 7. Certification */}
      {renderFacetAccordionItem(scope, "certification", facets.certifications, "checkbox")}

      {/* 8. Colour grade */}
      {renderFacetAccordionItem(scope, "color", facets.colors, "chips")}

      {/* 9. Clarity */}
      {renderFacetAccordionItem(scope, "clarity", facets.clarities, "chips")}

      {/* 10. Origin */}
      {renderFacetAccordionItem(scope, "origin", facets.origins, "checkbox")}
    </Accordion>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {fill(ui.collections.filters.showingStatus, {
          count: totalCount,
          noun: pieceNoun(totalCount),
        })}
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside
        aria-label={ui.collections.filters.sidebarAria}
        className={cn(
          "hidden shrink-0 transition-opacity lg:block lg:w-[280px] xl:w-[300px]",
          isPending && "pointer-events-none opacity-65",
        )}
      >
        <div className="filter-sidebar-scroll sticky top-[calc(var(--site-header-h)+1rem)] max-h-[calc(100dvh-var(--site-header-h)-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text">
                {ui.collections.filters.heading}
              </h2>
              {activeChips.length > 0 && (
                <span className="tabular-nums-price inline-flex min-w-5 items-center justify-center rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-text">
                  {activeChips.length}
                </span>
              )}
            </div>
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-8 cursor-pointer items-center px-1.5 text-xs font-medium text-accent-text hover:text-accent-hover hover:underline"
              >
                {ui.collections.filters.clearAll}
              </button>
            )}
          </div>

          {renderFilterAccordion("desktop")}
        </div>
      </aside>

      {/* Main Results Column */}
      <div className="min-w-0 flex-1">
        {/* Mobile & Tablet Sticky Action Bar (56px) */}
        <div
          style={{
            marginInline: "calc(var(--container-pad-inline) * -1)",
            paddingInline: "var(--container-pad-inline)",
          }}
          className={cn(
            "sticky top-[var(--sticky-top)] z-[var(--z-sticky)] mb-3 flex min-h-12 items-center justify-between gap-2 border-y border-border bg-header-bg py-1 backdrop-blur-md transition-[top,opacity] duration-[var(--duration-base)] ease-[var(--ease-out)] lg:hidden",
            isPending && "pointer-events-none opacity-65",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <LazyMobileFilterSheet
              activeCount={activeChips.length}
              totalCount={totalCount}
              onClearAll={clearAllFilters}
              disabled={isPending}
            >
              {renderFilterAccordion("mobile")}
            </LazyMobileFilterSheet>

            <LazyMobileSortSheet
              currentSort={currentSort}
              sortOptions={SORT_OPTIONS}
              disabled={isPending}
              onSelectSort={(val) =>
                navigateWithParams((next) => {
                  if (val === "featured") next.delete("sort");
                  else next.set("sort", val);
                })
              }
            />
          </div>

          <p className="tabular-nums-price shrink-0 pl-1 text-xs font-medium text-text-muted sm:text-sm">
            <AnimatedCounter value={totalCount} /> {pieceNoun(totalCount)}
          </p>
        </div>

        {/* Desktop Results Toolbar + Active Chips */}
        <div
          className={
            activeChips.length > 0
              ? "mb-5 space-y-3 border-b border-border pb-4 lg:mb-6"
              : "mb-6 hidden space-y-3 border-b border-border pb-4 lg:block"
          }
        >
          <div className="hidden items-center justify-between gap-4 lg:flex">
            <p className="tabular-nums-price text-sm text-text-2">
              <AnimatedCounter value={totalCount} /> {pieceNoun(totalCount)}
            </p>

            <div className="flex items-center gap-2.5">
              <span id="sort-label" className="sr-only text-sm text-text-2 lg:not-sr-only">
                {ui.collections.filters.sortBy}
              </span>
              <Select
                value={currentSort}
                disabled={isPending}
                onValueChange={(value) =>
                  navigateWithParams((next) => {
                    if (value === "featured") next.delete("sort");
                    else next.set("sort", value);
                  })
                }
              >
                <SelectTrigger aria-labelledby="sort-label" className="h-11 w-[210px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex scrollbar-none flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
              <AnimatePresence initial={false}>
                {activeChips.map((chip) => (
                  <m.button
                    key={chip.id}
                    type="button"
                    variants={chipVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={() => removeActiveChip(chip)}
                    className="transition-ui inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-accent/25 bg-accent-tint px-3 text-xs font-medium text-text hover:border-accent hover:bg-accent-tint/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span>{chip.label}</span>
                    <X className="size-3.5 text-text-2" strokeWidth={1.75} aria-hidden="true" />
                  </m.button>
                ))}
              </AnimatePresence>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center px-2 text-xs font-medium text-accent-text hover:text-accent-hover hover:underline"
              >
                {ui.collections.filters.clearAll}
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="bg-danger-tint text-danger-text mb-5 flex items-start gap-2.5 rounded-xl border border-danger/30 px-4 py-3 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="relative min-w-0" aria-busy={isPending}>
          {isPending && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 bg-bg/85 backdrop-blur-[1px]"
            >
              <div className={getProductGridClassName("catalog")}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <Skeleton className="aspect-[4/5] w-full rounded-none" />
                    <div className="space-y-2 p-3.5 sm:p-4">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={searchParams.toString() || "all"}
              initial={reducedMotion ? { opacity: 0.45 } : { opacity: 0.4, y: 6 }}
              animate={{ opacity: isPending ? 0.35 : 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={reducedMotion ? MOTION_TRANSITIONS.reduced : MOTION_TRANSITIONS.fast}
              className="min-w-0"
            >
              {children}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
