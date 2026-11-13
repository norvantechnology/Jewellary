"use client";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import { MOTION_EASE, useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: string | number;
  className?: string;
}

/**
 * Animated number/price transition using tabular-nums and GPU transform/opacity cross-fade.
 * Respects reduced-motion (short opacity fade) and prevents horizontal layout shift.
 */
export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const reducedMotion = useReducedMotionSafe();
  const display = String(value);

  return (
    <span
      className={cn(
        "tabular-nums-price relative inline-flex overflow-hidden align-baseline",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={display}
          initial={reducedMotion ? { opacity: 0.4 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={
            reducedMotion
              ? { duration: 0.12, ease: "easeOut" }
              : { duration: 0.2, ease: MOTION_EASE.out }
          }
          className="inline-block"
        >
          {display}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
