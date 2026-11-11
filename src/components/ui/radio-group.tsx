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
        "aspect-square size-5 cursor-pointer rounded-full border border-input bg-card text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent",
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
