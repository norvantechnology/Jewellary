"use client";

import * as React from "react";
import { Check, ChevronDown, Globe, Search, X } from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CurrencySwitcherProps {
  compact?: boolean;
  align?: "start" | "center" | "end";
  /**
   * When rendered inside MobileNavSheet (Radix Dialog), render as a non-portaled inline
   * accordion/listbox so focus trapping and 360px viewport fit remain flawless.
   */
  inDrawer?: boolean;
  onSelectCurrency?: () => void;
  tone?: "default" | "footer";
  className?: string;
}

export function CurrencySwitcher({
  compact = false,
  align = "end",
  inDrawer = false,
  onSelectCurrency,
  tone = "default",
  className,
}: CurrencySwitcherProps) {
  const { currencies, currency, setCurrency } = useCurrency();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [currencies, query]);

  const safeActiveIndex =
    filtered.length > 0 ? Math.min(Math.max(0, activeIndex), filtered.length - 1) : -1;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        const currentIdx = currencies.findIndex((c) => c.code === currency.code);
        setActiveIndex(currentIdx >= 0 ? currentIdx : 0);
      } else {
        setQuery("");
      }
    },
    [currencies, currency.code],
  );

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  function selectCode(code: string) {
    setCurrency(code);
    handleOpenChange(false);
    onSelectCurrency?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter" && safeActiveIndex >= 0 && filtered[safeActiveIndex]) {
      e.preventDefault();
      selectCode(filtered[safeActiveIndex]!.code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleOpenChange(false);
    }
  }

  const listboxPanel = (
    <div onKeyDown={handleKeyDown} className="w-full">
      <div className="flex items-center border-b border-border bg-surface-2/60 px-3 transition-colors focus-within:border-accent">
        <Search className="mr-2 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Search currency (e.g. EUR, GBP, JPY)"
          aria-label="Search currency"
          aria-controls={listId}
          aria-activedescendant={
            safeActiveIndex >= 0 && filtered[safeActiveIndex]
              ? `${listId}-opt-${filtered[safeActiveIndex]!.code}`
              : undefined
          }
          className="h-11 w-full border-0 bg-transparent py-2 text-base text-text shadow-none ring-0 outline-none placeholder:text-text-muted focus:ring-0 focus:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-sm"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              searchInputRef.current?.focus();
            }}
            aria-label="Clear currency search"
            className="-mr-1.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Available currencies"
        className="max-h-60 overflow-y-auto p-1.5"
      >
        {filtered.length === 0 ? (
          <li className="py-5 text-center text-sm text-text-muted">No matching currencies</li>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = item.code === currency.code;
            const isHighlighted = idx === safeActiveIndex;
            return (
              <li
                key={item.code}
                id={`${listId}-opt-${item.code}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectCode(item.code)}
                  className={cn(
                    "transition-ui flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                    isHighlighted ? "bg-surface-3 text-text" : "text-text hover:bg-surface-2",
                    isSelected && "font-semibold",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex w-10 shrink-0 font-mono text-xs font-semibold text-accent-text">
                      {item.code}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums-price text-xs text-text-muted">
                      {item.symbol}
                    </span>
                    <Check
                      className={cn(
                        "size-4 text-accent-text",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  if (inDrawer) {
    return (
      <div className={cn("w-full", className)}>
        <button
          type="button"
          onClick={() => handleOpenChange(!open)}
          aria-expanded={open}
          aria-controls={`${listId}-drawer-panel`}
          aria-label={`Select currency, current ${currency.code} (${currency.name})`}
          className="transition-ui flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe
              className="size-4 shrink-0 text-accent-text"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className="shrink-0 font-mono text-xs font-semibold">{currency.code}</span>
            <span className="shrink-0 text-text-muted">{currency.symbol}</span>
            <span className="truncate text-xs text-text-muted">· {currency.name}</span>
          </span>
          <ChevronDown
            className={cn("size-4 text-text-muted transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            id={`${listId}-drawer-panel`}
            className="mt-2 overflow-hidden rounded-lg border border-border bg-surface text-text shadow-sm"
          >
            {listboxPanel}
          </div>
        )}
      </div>
    );
  }

  const isFooter = tone === "footer";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Currency selector: ${currency.code} (${currency.symbol})`}
          className={cn(
            "transition-ui inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
            isFooter
              ? "border-footer-border bg-footer-input-bg text-footer-text hover:border-footer-accent hover:bg-footer-input-bg focus-visible:outline-footer-accent"
              : "border-border-strong bg-surface text-text hover:border-text-2 hover:bg-surface-2 focus-visible:outline-accent",
            compact && "h-11 px-2.5",
            className,
          )}
        >
          <Globe
            className={cn("size-4 shrink-0", isFooter ? "text-footer-muted" : "text-text-muted")}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className="font-mono font-semibold">{currency.code}</span>
          <span className={isFooter ? "text-footer-muted" : "text-text-muted"}>
            {currency.symbol}
          </span>
          <ChevronDown
            className={cn("size-4", isFooter ? "text-footer-muted" : "text-text-muted")}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        role="dialog"
        aria-label="Select display currency"
        className="z-[var(--z-modal)] w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        {listboxPanel}
      </PopoverContent>
    </Popover>
  );
}
