"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "@/lib/utils";

export const Select = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Trigger>) {
  return (
    <RadixSelect.Trigger
      className={cn(
        "transition-ui flex h-12 min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3.5 text-base text-text focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 data-[placeholder]:text-text-muted md:h-11 md:min-h-11 md:text-sm",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <RadixSelect.Icon asChild>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: React.ComponentProps<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "ma-popover z-[var(--z-dropdown)] max-h-[min(var(--radix-select-content-available-height),18rem)] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md sm:max-h-72",
          className,
        )}
        {...props}
      >
        <RadixSelect.Viewport className="max-h-[min(var(--radix-select-content-available-height),18rem)] overflow-y-auto p-1">
          {children}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        "relative flex min-h-11 w-full cursor-pointer items-center rounded-md py-2 pr-3 pl-9 text-base text-popover-foreground transition-colors outline-none select-none focus:bg-surface-2 focus:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[state=checked]:font-medium sm:min-h-9 sm:py-1.5 sm:pl-8 sm:text-sm",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check className="size-4 text-accent-text" strokeWidth={2} aria-hidden="true" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof RadixSelect.Label>) {
  return (
    <RadixSelect.Label
      className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
