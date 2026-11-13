"use client";

import * as React from "react";
import { useReducedMotionSafe } from "@/lib/motion";

interface HeaderScrollShellProps {
  children: React.ReactNode;
}

/**
 * Passive GPU-composited sticky header scroll coordinator:
 * - Avoids React re-renders per scroll pixel by flipping boolean state strictly at thresholds.
 * - Desktop: subtly scales surface backdrop & tightens nav row while fading solid fill + shadow.
 * - Mobile (<1024px): slides out on scroll-down past 96px, reveals cleanly on scroll-up.
 */
export function HeaderScrollShell({ children }: HeaderScrollShellProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileHidden, setMobileHidden] = React.useState(false);
  const lastYRef = React.useRef(0);
  const reducedMotion = useReducedMotionSafe();

  const headerRef = React.useRef<HTMLElement>(null);

  // Publish the real rendered header height (incl. announcement bar) so sticky sub-bars sit flush.
  React.useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--site-header-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--site-header-h");
    };
  }, []);

  React.useEffect(() => {
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const y = window.scrollY;
      const nextScrolled = y > 24;
      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      const isMobile = window.innerWidth < 1024;
      const delta = y - lastYRef.current;
      lastYRef.current = y;

      if (!isMobile || reducedMotion || y <= 96) {
        setMobileHidden((prev) => (prev ? false : prev));
        return;
      }

      if (delta > 6) {
        setMobileHidden((prev) => (prev ? prev : true));
      } else if (delta < -6) {
        setMobileHidden((prev) => (prev ? false : prev));
      }
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    rafId = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <header
      ref={headerRef}
      data-vt="header"
      data-scrolled={scrolled ? "true" : "false"}
      data-hidden={mobileHidden ? "true" : "false"}
      className="ma-header sticky top-0 z-[var(--z-header)]"
    >
      <div className="ma-header-surface" aria-hidden="true" />
      {children}
    </header>
  );
}
