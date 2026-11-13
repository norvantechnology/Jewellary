"use client";

import * as React from "react";
import { Circle } from "lucide-react";
import { RadioGroup as RadixRadioGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadixRadioGroup.Root>) {
  return <RadixRadioGroup.Root className={cn("grid gap-2.5", className)} {...props} />;
}

export function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadixRadioGroup.Item>) {
  return (
    <RadixRadioGroup.Item
      className={cn(
        "transition-ui relative aspect-square size-5 cursor-pointer rounded-full border border-border-strong bg-surface text-accent-text before:absolute before:-inset-3 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent-hover data-[state=checked]:bg-accent-tint dark:data-[state=checked]:border-accent",
        className,
      )}
      {...props}
    >
      <RadixRadioGroup.Indicator className="flex items-center justify-center">
        <Circle className="size-2.5 fill-current text-current" aria-hidden="true" />
      </RadixRadioGroup.Indicator>
    </RadixRadioGroup.Item>
  );
}
