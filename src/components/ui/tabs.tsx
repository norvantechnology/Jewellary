"use client";

import * as React from "react";
import { Tabs as RadixTabs } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn(
        "flex w-full max-w-full scrollbar-none flex-nowrap items-center gap-1 overflow-x-auto border-b border-border bg-transparent p-0 text-muted-foreground sm:flex-wrap",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "transition-ui relative inline-flex min-h-11 cursor-pointer items-center justify-center border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-text-muted after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 after:ease-out hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 data-[state=active]:text-text data-[state=active]:after:scale-x-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content className={cn("mt-5 focus-visible:outline-none", className)} {...props} />
  );
}
