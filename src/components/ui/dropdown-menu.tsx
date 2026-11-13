"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { DropdownMenu as RadixDropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

export function DropdownMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.Root>) {
  return <RadixDropdownMenu.Root modal={modal} {...props} />;
}
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuGroup = RadixDropdownMenu.Group;
export const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 12,
  children,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "ma-popover z-[var(--z-dropdown)] max-h-[min(var(--radix-dropdown-menu-content-available-height),20rem)] max-w-[calc(100vw-1.5rem)] min-w-44 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-md",
          className,
        )}
        {...props}
      >
        {children}
      </RadixDropdownMenu.Content>
    </RadixDropdownMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.Item>) {
  return (
    <RadixDropdownMenu.Item
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-base text-popover-foreground transition-colors outline-none select-none focus:bg-surface-2 focus:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-45 sm:min-h-9 sm:py-1.5 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.RadioItem>) {
  return (
    <RadixDropdownMenu.RadioItem
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center rounded-md py-2 pr-3 pl-9 text-base text-popover-foreground transition-colors outline-none select-none focus:bg-surface-2 focus:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-45 sm:min-h-9 sm:py-1.5 sm:pl-8 sm:text-sm",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center">
        <RadixDropdownMenu.ItemIndicator>
          <Check className="size-4 text-accent-text" strokeWidth={2} aria-hidden="true" />
        </RadixDropdownMenu.ItemIndicator>
      </span>
      {children}
    </RadixDropdownMenu.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.Label>) {
  return (
    <RadixDropdownMenu.Label
      className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof RadixDropdownMenu.Separator>) {
  return (
    <RadixDropdownMenu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />
  );
}
