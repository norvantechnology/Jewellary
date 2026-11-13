"use client";

import * as React from "react";
import {
  observeSharedIntersection,
  useDocumentVisible,
  useIsLowEndDevice,
  useReducedMotionSafe,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FloatProps {
  children: React.ReactNode;
  amplitude?: number;
  duration?: number;
  delay?: number;
  rotate?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * GPU-composited gentle floating wrapper.
 * Automatically pauses when off-screen or tab is hidden, and disables on reduced motion / low-end devices.
 * Intended strictly for hero visuals, empty states, 404, and confirmation displays (max 3 per viewport).
 */
export function Float({
  children,
  amplitude = 8,
  duration = 7,
  delay = 0,
  rotate = 1.5,
  disabled = false,
  className,
}: FloatProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [inViewport, setInViewport] = React.useState(true);
  const reducedMotion = useReducedMotionSafe();
  const lowEnd = useIsLowEndDevice();
  const tabVisible = useDocumentVisible();

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    return observeSharedIntersection(
      el,
      (entry) => {
        setInViewport(entry.isIntersecting);
      },
      { threshold: 0.01 },
    );
  }, []);

  const active = !disabled && !reducedMotion && !lowEnd;
  const paused = !active || !inViewport || !tabVisible;

  return (
    <div
      ref={ref}
      data-paused={paused ? "true" : "false"}
      className={cn(active && "ma-float", className)}
      style={
        active
          ? {
              ["--float-y" as string]: `${amplitude}px`,
              ["--float-duration" as string]: `${duration}s`,
              ["--float-delay" as string]: `${delay}s`,
              ["--float-rot" as string]: `${rotate}deg`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

interface FloatSparklesProps {
  className?: string;
  disabled?: boolean;
}

/**
 * Subtle decorative champagne glint accents (2 elements, max 3 total with Float container).
 * Automatically hidden under reduced-motion or low-end devices and paused off-screen.
 */
export function FloatSparkles({ className, disabled = false }: FloatSparklesProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [inViewport, setInViewport] = React.useState(true);
  const reducedMotion = useReducedMotionSafe();
  const lowEnd = useIsLowEndDevice();
  const tabVisible = useDocumentVisible();

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    return observeSharedIntersection(
      el,
      (entry) => {
        setInViewport(entry.isIntersecting);
      },
      { threshold: 0.01 },
    );
  }, []);

  if (disabled || reducedMotion || lowEnd) {
    return null;
  }

  const paused = !inViewport || !tabVisible ? "true" : "false";

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <span
        data-paused={paused}
        className="ma-glint absolute top-[14%] right-[12%] size-2 rounded-full bg-accent/70"
        style={{
          ["--glint-duration" as string]: "4.6s",
          ["--glint-delay" as string]: "0.4s",
        }}
      />
      <span
        data-paused={paused}
        className="ma-glint absolute bottom-[18%] left-[14%] size-1.5 rounded-full bg-accent/60"
        style={{
          ["--glint-duration" as string]: "5.6s",
          ["--glint-delay" as string]: "1.5s",
        }}
      />
    </div>
  );
}
