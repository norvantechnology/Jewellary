"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderOffset } from "@/components/storefront/customize/useHeaderOffset";
import type { CustomizeStep } from "@/components/storefront/customize/types";

const STEPS: Array<{ step: CustomizeStep; label: string }> = [
  { step: 1, label: "Options" },
  { step: 2, label: "Details" },
  { step: 3, label: "Review" },
];

interface CustomizeProgressProps {
  step: CustomizeStep;
  onSelectStep: (step: CustomizeStep) => void;
  variant: "page" | "drawer";
}

export function CustomizeProgress({ step, onSelectStep, variant }: CustomizeProgressProps) {
  const { mobileStickyTop } = useHeaderOffset(variant === "page");
  const currentStepLabel = STEPS.find((item) => item.step === step)?.label ?? "Options";

  return (
    <nav
      aria-label="Customization steps"
      style={variant === "page" ? { top: `${mobileStickyTop}px` } : undefined}
      className={cn(
        "border-b border-border py-2.5 [@media(max-height:500px)]:py-1.5",
        variant === "drawer"
          ? "shrink-0 bg-surface px-5 sm:px-6"
          : "sticky z-[var(--z-sticky)] -mx-4 bg-header-bg px-4 backdrop-blur-md transition-[top] duration-200 sm:-mx-6 sm:px-6 lg:hidden",
      )}
    >
      <span className="sr-only" aria-live="polite">
        Step {step} of 3: {currentStepLabel}
      </span>

      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className={cn(
              "h-1 rounded-[8px] transition-colors duration-200",
              item.step <= step ? "bg-accent" : "bg-border",
            )}
          />
        ))}
      </div>

      {/* Narrow phones (<400px): single-line compact progress label */}
      <p className="mt-2 truncate text-[13px] font-medium text-muted-foreground min-[400px]:hidden">
        Step {step} of 3 · <span className="font-semibold text-foreground">{currentStepLabel}</span>
      </p>

      {/* >=400px: single non-wrapping row aligned below segments */}
      <ol className="mt-1.5 hidden flex-nowrap items-center justify-between gap-2 min-[400px]:flex">
        {STEPS.map((item, idx) => {
          const isActive = item.step === step;
          const isCompleted = item.step < step;
          return (
            <React.Fragment key={item.step}>
              {idx > 0 ? (
                <li
                  aria-hidden="true"
                  className="shrink-0 text-[13px] text-muted-foreground/50 select-none"
                >
                  ·
                </li>
              ) : null}
              <li className="min-w-0 shrink-0">
                <button
                  type="button"
                  disabled={!isCompleted && !isActive}
                  onClick={() => {
                    if (isCompleted) onSelectStep(item.step);
                  }}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1 rounded px-2 text-[13px] leading-[1.3] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isActive
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "cursor-pointer font-medium text-accent-text hover:text-foreground"
                        : "cursor-default text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
                  ) : null}
                  <span>{item.label}</span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
