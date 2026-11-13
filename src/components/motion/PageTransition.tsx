"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useIsLowEndDevice, useReducedMotionSafe } from "@/lib/motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

function PageTransitionObserver({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pathname = usePathname();
  const lastPathnameRef = React.useRef<string | null>(null);
  const reducedMotion = useReducedMotionSafe();
  const lowEnd = useIsLowEndDevice();

  React.useEffect(() => {
    const prev = lastPathnameRef.current;
    lastPathnameRef.current = pathname;

    if (prev === null || prev === pathname) return;

    const el = targetRef.current;
    if (!el || typeof el.animate !== "function") return;

    if (reducedMotion || lowEnd) {
      el.animate([{ opacity: 0.65 }, { opacity: 1 }], {
        duration: 120,
        easing: "ease-out",
      });
      return;
    }

    el.animate(
      [
        { opacity: 0.01, transform: "translate3d(0, 8px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  }, [pathname, reducedMotion, lowEnd, targetRef]);

  return null;
}

/**
 * Lightweight client route transition wrapper (220ms opacity + 8px translateY).
 * Initial SSR render uses opacity: 1 with zero delay; WAAPI runs only on subsequent client route changes.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  return (
    <div ref={ref}>
      <React.Suspense fallback={null}>
        <PageTransitionObserver targetRef={ref} />
      </React.Suspense>
      {children}
    </div>
  );
}
