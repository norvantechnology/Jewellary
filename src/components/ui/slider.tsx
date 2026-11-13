"use client";

import * as React from "react";
import { Slider as RadixSlider } from "radix-ui";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  defaultValue,
  value,
  thumbAriaLabel,
  ...props
}: React.ComponentProps<typeof RadixSlider.Root> & {
  thumbAriaLabel?: string;
}) {
  const thumbCount = (value ?? defaultValue ?? [0]).length;

  return (
    <RadixSlider.Root
      defaultValue={defaultValue}
      value={value}
      className={cn("relative flex h-6 w-full touch-none items-center py-0 select-none", className)}
      {...props}
    >
      <RadixSlider.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-3">
        <RadixSlider.Range className="absolute h-full bg-accent" />
      </RadixSlider.Track>
      {Array.from({ length: thumbCount }).map((_, idx) => (
        <RadixSlider.Thumb
          key={idx}
          aria-label={
            thumbAriaLabel
              ? thumbCount > 1
                ? `${thumbAriaLabel} ${idx + 1}`
                : thumbAriaLabel
              : `Range thumb ${idx + 1}`
          }
          className="transition-ui relative block size-5 cursor-pointer rounded-full border-2 border-surface bg-accent shadow-sm before:absolute before:-inset-3 before:content-[''] hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-115 disabled:pointer-events-none disabled:opacity-45"
        />
      ))}
    </RadixSlider.Root>
  );
}
