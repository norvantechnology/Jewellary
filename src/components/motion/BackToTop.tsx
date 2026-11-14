"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITIONS, useReducedMotionSafe } from "@/lib/motion";

/**
 * Passive GPU-composited reading/scroll progress bar at top of viewport (`transform: scaleX`).
 * Updates DOM style directly on passive scroll events for zero React re-renders.
 */
export function ScrollProgressBar() {
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionSafe();

  React.useEffect(() => {
    if (reducedMotion) return;
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const el = barRef.current;
      if (!el) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      el.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-sticky)] h-[2px] print:hidden"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-accent/80"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/**
 * Smooth back-to-top button appearing after 600px scroll with fade + scale spring.
 */
export function BackToTop() {
  const ui = useUiText();
  const [visible, setVisible] = React.useState(false);
  const reducedMotion = useReducedMotionSafe();

  React.useEffect(() => {
    let rafId: number | null = null;
    const check = () => {
      rafId = null;
      const shouldShow = window.scrollY > 600;
      setVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    };
    const onScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <m.button
          data-focus-hide=""
          type="button"
          onClick={scrollToTop}
          aria-label={ui.common.backToTop}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 8 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 8 }}
          transition={reducedMotion ? MOTION_TRANSITIONS.reduced : MOTION_SPRING.snappy}
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+var(--sticky-cta-offset,0px))] z-[var(--z-sticky)] inline-flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-md backdrop-blur-md hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:right-6 lg:bottom-[5.5rem] print:hidden"
        >
          <ArrowUp className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </m.button>
      )}
    </AnimatePresence>
  );
}
