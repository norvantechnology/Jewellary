"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Checkbox as RadixCheckbox } from "radix-ui";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        "peer transition-ui relative size-[18px] shrink-0 cursor-pointer rounded-sm border border-border-strong bg-surface text-on-accent before:absolute before:-inset-3.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent-hover data-[state=checked]:bg-accent dark:data-[state=checked]:border-accent",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
