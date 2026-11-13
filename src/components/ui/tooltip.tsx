"use client";

import * as React from "react";
import { Tooltip as RadixTooltip } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "ma-popover z-[var(--z-drawer)] rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md",
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}
