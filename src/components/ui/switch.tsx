"use client";

import * as React from "react";
import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        "peer transition-ui relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-3 p-0.5 before:absolute before:-inset-x-0.5 before:-inset-y-2.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="pointer-events-none block size-5 translate-x-0 rounded-full bg-surface shadow-sm ring-1 ring-border-strong/40 transition-transform duration-150 data-[state=checked]:translate-x-[18px] dark:bg-text dark:data-[state=checked]:bg-on-accent" />
    </RadixSwitch.Root>
  );
}
