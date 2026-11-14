"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  inModal?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function Combobox({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyText = "No matches found.",
  className,
  disabled,
  inModal = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((opt) => opt.value === value);
  const computedAriaLabel =
    ariaLabel ?? (!id && !ariaLabelledBy ? (selected?.label ?? placeholder) : undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={computedAriaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className={cn(
            "min-h-12 w-full justify-between text-base font-normal md:min-h-11 md:text-sm",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={!inModal}
        className="z-[var(--z-modal)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] min-w-[min(16rem,calc(100vw-2rem))] overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          // Touch screens: don't focus the search box (it would pop the keyboard over the list).
          // People can still tap it to search; mouse/keyboard users keep type-to-search.
          if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
        }}
      >
        <Command className="bg-popover text-popover-foreground">
          <div className="flex items-center border-b border-border bg-surface-2/60 px-3 transition-colors focus-within:border-accent">
            <Search className="mr-2 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <Command.Input
              placeholder={searchPlaceholder}
              className="flex h-12 w-full border-0 bg-transparent py-2 text-base text-text shadow-none ring-0 outline-none placeholder:text-text-muted focus:ring-0 focus:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:h-11 md:text-sm"
            />
          </div>
          <Command.List className="max-h-[45dvh] overflow-y-auto p-1 sm:max-h-60">
            <Command.Empty className="py-6 text-center text-sm text-text-muted">
              {emptyText}
            </Command.Empty>
            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onValueChange(option.value === value ? "" : option.value);
                  setOpen(false);
                }}
                className="relative flex min-h-11 cursor-pointer items-center rounded-sm py-2 pr-3 pl-8 text-base text-text outline-none hover:bg-surface-2/70 aria-selected:bg-surface-2 aria-selected:text-text md:min-h-10 md:text-sm"
              >
                <Check
                  className={cn(
                    "absolute left-2.5 size-4 text-accent-text",
                    value === option.value ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                {option.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
