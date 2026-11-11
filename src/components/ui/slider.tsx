"use client";

import * as React from "react";
import { Slider as RadixSlider } from "radix-ui";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  defaultValue,
  value,
  ...props
}: React.ComponentProps<typeof RadixSlider.Root>) {
  const thumbCount = (value ?? defaultValue ?? [0]).length;

  return (
    <RadixSlider.Root
      defaultValue={defaultValue}
      value={value}
      className={cn("relative flex w-full touch-none items-center py-2 select-none", className)}
      {...props}
    >
      <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <RadixSlider.Range className="absolute h-full bg-accent" />
      </RadixSlider.Track>
      {Array.from({ length: thumbCount }).map((_, idx) => (
        <RadixSlider.Thumb
          key={idx}
          aria-label={`Range thumb ${idx + 1}`}
          className="block size-5 cursor-pointer rounded-full border-2 border-accent bg-card shadow-soft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </RadixSlider.Root>
  );
}
