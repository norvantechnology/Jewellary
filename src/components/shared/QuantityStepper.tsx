"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import { Minus, Plus } from "lucide-react";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
  size?: "default" | "compact";
  className?: string;
}

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled = false,
  label,
  size = "default",
  className,
}: QuantityStepperProps) {
  const ui = useUiText();
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;
  const isCompact = size === "compact";
  const buttonSizeClass = isCompact ? "size-9" : "size-11";
  const iconSizeClass = isCompact ? "size-3.5" : "size-4";
  const valueSizeClass = isCompact ? "min-w-8 text-sm" : "min-w-9 text-base";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border-strong bg-surface",
        className,
      )}
      role="group"
      aria-label={label ?? ui.common.quantity}
    >
      <button
        type="button"
        onClick={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        aria-label={ui.common.decreaseQuantity}
        className={cn(
          "transition-ui inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-l-md text-text hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40",
          buttonSizeClass,
        )}
      >
        <Minus className={iconSizeClass} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        className={cn("tabular-nums-price text-center font-medium text-text", valueSizeClass)}
      >
        <AnimatedCounter value={value} />
      </span>
      <button
        type="button"
        onClick={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        aria-label={ui.common.increaseQuantity}
        className={cn(
          "transition-ui inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-r-md text-text hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40",
          buttonSizeClass,
        )}
      >
        <Plus className={iconSizeClass} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
