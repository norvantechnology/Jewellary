"use client";

import * as React from "react";
import { Popover as RadixPopover } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  collisionPadding = 12,
  portalled = true,
  ...props
}: React.ComponentProps<typeof RadixPopover.Content> & {
  portalled?: boolean;
}) {
  const content = (
    <RadixPopover.Content
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "ma-popover z-[var(--z-dropdown)] max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none sm:w-72 sm:p-4",
        className,
      )}
      {...props}
    />
  );

  if (!portalled) {
    return content;
  }

  return <RadixPopover.Portal>{content}</RadixPopover.Portal>;
}
