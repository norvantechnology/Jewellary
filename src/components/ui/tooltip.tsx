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
  ...props
}: React.ComponentProps<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-sm border border-border bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-soft",
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}
