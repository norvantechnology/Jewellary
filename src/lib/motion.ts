"use client";

import * as React from "react";
import { useReducedMotion, type Transition, type Variants } from "motion/react";

/** Shared duration tokens in seconds (aligned with src/styles/tokens.css) */
export const MOTION_DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  reducedFade: 0.12,
} as const;

export const MOTION_DURATION_MS = {
  fast: 150,
  base: 250,
  slow: 450,
  reducedFade: 120,
} as const;

/** Shared easing curves */
export const MOTION_EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
} as const;

/** Shared spring presets */
export const MOTION_SPRING = {
  soft: { type: "spring", stiffness: 260, damping: 28 } as const,
  snappy: { type: "spring", stiffness: 420, damping: 32 } as const,
} as const;

/** Shared spacing / timing constants */
export const MOTION_STAGGER = 0.06;
export const MOTION_STAGGER_MS = 60;
export const MOTION_MENU_STAGGER = 0.02;
export const MOTION_TRAVEL = 16;
export const MOTION_PAGE_TRAVEL = 8;

export const MOTION_TRANSITIONS = {
  fast: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.out } satisfies Transition,
  base: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out } satisfies Transition,
  slow: { duration: MOTION_DURATION.slow, ease: MOTION_EASE.out } satisfies Transition,
  reduced: { duration: MOTION_DURATION.reducedFade, ease: "easeOut" } satisfies Transition,
  softSpring: MOTION_SPRING.soft satisfies Transition,
  snappySpring: MOTION_SPRING.snappy satisfies Transition,
} as const;

/** Shared reusable variants (no inline one-off definitions across components) */
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: {
    opacity: 0,
    transition: MOTION_TRANSITIONS.fast,
  },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: MOTION_TRAVEL },
  visible: {
    opacity: 1,
    y: 0,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: MOTION_TRANSITIONS.fast,
  },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: MOTION_TRANSITIONS.fast,
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: MOTION_STAGGER,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: MOTION_TRAVEL },
  visible: {
    opacity: 1,
    y: 0,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: MOTION_TRANSITIONS.fast,
  },
};

export const menuContainerVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: MOTION_EASE.out,
      staggerChildren: MOTION_MENU_STAGGER,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.98,
    transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.out },
  },
};

export const menuItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.out },
  },
};

export const drawerLeftVariants: Variants = {
  hidden: { x: "-100%", opacity: 0.9 },
  visible: { x: 0, opacity: 1, transition: MOTION_SPRING.soft },
  exit: { x: "-100%", opacity: 0.9, transition: { duration: 0.2, ease: MOTION_EASE.inOut } },
};

export const drawerRightVariants: Variants = {
  hidden: { x: "100%", opacity: 0.9 },
  visible: { x: 0, opacity: 1, transition: MOTION_SPRING.snappy },
  exit: { x: "100%", opacity: 0.9, transition: { duration: 0.2, ease: MOTION_EASE.inOut } },
};

export const sheetBottomVariants: Variants = {
  hidden: { y: "100%", opacity: 0.92 },
  visible: { y: 0, opacity: 1, transition: MOTION_SPRING.snappy },
  exit: { y: "100%", opacity: 0.92, transition: { duration: 0.2, ease: MOTION_EASE.inOut } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: MOTION_TRANSITIONS.fast,
  },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: MOTION_TRANSITIONS.fast,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: 0.12, ease: MOTION_EASE.out },
  },
};

export const chipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: MOTION_TRANSITIONS.fast,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.12, ease: MOTION_EASE.out },
  },
};

export const slideStepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 18 : -18,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: MOTION_TRANSITIONS.base,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -14 : 14,
    transition: MOTION_TRANSITIONS.fast,
  }),
};

export function getMotionTransition(
  reducedMotion: boolean,
  preferred: Transition = MOTION_TRANSITIONS.base,
): Transition {
  return reducedMotion ? MOTION_TRANSITIONS.reduced : preferred;
}

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
}

function subscribeMediaQuery(query: string) {
  return (callback: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return () => {};
    }
    const mq = window.matchMedia(query);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  };
}

function getMediaQuerySnapshot(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

const subscribeReducedMedia = subscribeMediaQuery("(prefers-reduced-motion: reduce)");
const subscribeTouchMedia = subscribeMediaQuery("(hover: none), (pointer: coarse)");

function subscribeVisibility(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function getVisibilitySnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return !document.hidden;
}

function subscribeNoop(): () => void {
  return () => {};
}

function getLowEndSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  const navWithConn = navigator as Navigator & { connection?: NavigatorConnection };
  const conn = navWithConn.connection;
  const lowCores = typeof cores === "number" && cores > 0 && cores <= 4;
  const saveData = Boolean(conn?.saveData);
  const slowNet = conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g";
  return lowCores || saveData || slowNet;
}

/**
 * Returns true if the user requested reduced motion via OS setting or MotionConfig.
 * Safe during SSR (defaults false to match server markup cleanly).
 */
export function useReducedMotionSafe(): boolean {
  const motionPref = useReducedMotion();
  const mediaPref = React.useSyncExternalStore(
    subscribeReducedMedia,
    () => getMediaQuerySnapshot("(prefers-reduced-motion: reduce)"),
    () => false,
  );
  return Boolean(motionPref || mediaPref);
}

/**
 * Returns true on constrained devices (`hardwareConcurrency <= 4` or `saveData`).
 */
export function useIsLowEndDevice(): boolean {
  return React.useSyncExternalStore(subscribeNoop, getLowEndSnapshot, () => false);
}

/**
 * Returns true on coarse-pointer / touch devices where hover effects should be suppressed.
 */
export function useIsTouchDevice(): boolean {
  return React.useSyncExternalStore(
    subscribeTouchMedia,
    () => getMediaQuerySnapshot("(hover: none), (pointer: coarse)"),
    () => false,
  );
}

/**
 * Tracks browser tab visibility so infinite CSS/JS animations pause when hidden.
 */
export function useDocumentVisible(): boolean {
  return React.useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => true);
}

export interface UseInViewOnceOptions {
  rootMargin?: string;
  threshold?: number;
  disabled?: boolean;
  mode?: "reveal" | "stagger";
}

/**
 * Progressive IntersectionObserver helper:
 * - Synchronizes `data-ma-reveal` / `data-ma-stagger` DOM attributes with zero SSR flash.
 * - Updates reactive `inView` boolean strictly inside asynchronous callbacks (no cascading effect renders).
 */
type SharedIntersectionCallback = (entry: IntersectionObserverEntry) => void;

interface SharedObserverEntry {
  observer: IntersectionObserver;
  targets: Map<Element, Set<SharedIntersectionCallback>>;
}

const sharedObservers = new Map<string, SharedObserverEntry>();

function getSharedObserver(rootMargin: string, threshold: number): SharedObserverEntry {
  const key = `${rootMargin}|${threshold}`;
  const existing = sharedObservers.get(key);
  if (existing) return existing;

  const targets = new Map<Element, Set<SharedIntersectionCallback>>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callbacks = targets.get(entry.target);
        if (!callbacks) continue;
        // Iterate over a snapshot in case a callback unsubscribes itself mid-loop
        for (const cb of [...callbacks]) {
          cb(entry);
        }
      }
    },
    { rootMargin, threshold },
  );

  const created: SharedObserverEntry = { observer, targets };
  sharedObservers.set(key, created);
  return created;
}

export function observeSharedIntersection(
  el: Element,
  callback: SharedIntersectionCallback,
  options: { rootMargin?: string; threshold?: number } = {},
): () => void {
  const { rootMargin = "0px", threshold = 0 } = options;
  const { observer, targets } = getSharedObserver(rootMargin, threshold);
  let callbacks = targets.get(el);
  if (!callbacks) {
    callbacks = new Set();
    targets.set(el, callbacks);
    observer.observe(el);
  }
  callbacks.add(callback);

  return () => {
    const current = targets.get(el);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) {
      targets.delete(el);
      observer.unobserve(el);
    }
  };
}

export function useInViewOnce<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: UseInViewOnceOptions = {},
): boolean {
  const { rootMargin = "-10% 0px", threshold = 0.02, disabled = false, mode = "reveal" } = options;
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const attrName = mode === "stagger" ? "maStagger" : "maReveal";

    if (disabled || typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      el.dataset[attrName] = "visible";
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }

    let revealed = false;
    let stopObserving: (() => void) | null = null;
    stopObserving = observeSharedIntersection(
      el,
      (entry) => {
        if (revealed) return;
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight * 0.96) {
          revealed = true;
          el.dataset[attrName] = "visible";
          setInView(true);
          stopObserving?.();
          stopObserving = null;
        } else if (el.dataset[attrName] !== "armed") {
          el.dataset[attrName] = "armed";
        }
      },
      { rootMargin, threshold },
    );

    return () => {
      stopObserving?.();
      stopObserving = null;
    };
  }, [ref, rootMargin, threshold, disabled, mode]);

  return inView;
}

interface FlipBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * FLIP sliding active-indicator helper for `LazyMotion + domAnimation` (which omits `layoutId`).
 * Measures `[data-ma-indicator="true"]` relative to `containerRef` and WAAPI-animates
 * `transform: translate3d(...) scale(...)` from the previous active target on key changes.
 */
export function useFlipIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeKey: string | number | null | undefined,
  disabled = false,
): void {
  const prevBoxRef = React.useRef<FlipBox | null>(null);
  const lastKeyRef = React.useRef<string | number | null | undefined>(activeKey);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const indicator = container.querySelector<HTMLElement>('[data-ma-indicator="true"]');
    if (!indicator) {
      prevBoxRef.current = null;
      lastKeyRef.current = activeKey;
      return;
    }

    const cRect = container.getBoundingClientRect();
    const rect = indicator.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const curr: FlipBox = {
      x: rect.left - cRect.left,
      y: rect.top - cRect.top,
      w: rect.width,
      h: rect.height,
    };

    const prev = prevBoxRef.current;
    const keyChanged = lastKeyRef.current !== activeKey;
    prevBoxRef.current = curr;
    lastKeyRef.current = activeKey;

    if (!prev || !keyChanged || disabled || typeof indicator.animate !== "function") {
      return;
    }

    const dx = prev.x - curr.x;
    const dy = prev.y - curr.y;
    const sx = prev.w / Math.max(1, curr.w);
    const sy = prev.h / Math.max(1, curr.h);

    if (
      Math.abs(dx) < 0.5 &&
      Math.abs(dy) < 0.5 &&
      Math.abs(sx - 1) < 0.02 &&
      Math.abs(sy - 1) < 0.02
    ) {
      return;
    }

    indicator.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
        },
        {
          transformOrigin: "top left",
          transform: "translate3d(0, 0, 0) scale(1, 1)",
        },
      ],
      {
        duration: 240,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  }, [containerRef, activeKey, disabled]);
}

export interface UseSwipeDismissOptions {
  /** Axis and sign toward which swipe closes: left drawer = "-x", right drawer = "+x", bottom sheet = "+y". */
  direction: "-x" | "+x" | "+y";
  enabled?: boolean;
  threshold?: number;
  onDismiss?: () => void;
  /** Optional handle element ref (e.g. bottom sheet grip) when swipe should start only on the handle. */
  handleRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Lightweight 60fps pointer swipe-to-dismiss helper compatible with `LazyMotion + domAnimation`
 * (avoids `domMax` drag overhead, passes React Compiler ref rules, and never blocks scrolling).
 */
export function useSwipeDismiss(
  targetRef: React.RefObject<HTMLElement | null>,
  { direction, enabled = true, threshold = 72, onDismiss, handleRef }: UseSwipeDismissOptions,
): void {
  const onDismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  React.useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let rafId: number | null = null;
    let cleanupListeners: (() => void) | null = null;

    const attach = () => {
      if (disposed) return;
      const targetEl = targetRef.current;
      const downEl = handleRef?.current ?? targetEl;
      if (!targetEl || !downEl) {
        rafId = window.requestAnimationFrame(attach);
        return;
      }

      const isHorizontal = direction === "-x" || direction === "+x";
      let active = false;
      let locked = false;
      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let offset = 0;

      const detachWindow = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishSwipe);
        window.removeEventListener("pointercancel", finishSwipe);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!active) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!locked) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          const axisMatches =
            direction === "-x"
              ? dx < 0 && Math.abs(dx) > Math.abs(dy)
              : direction === "+x"
                ? dx > 0 && Math.abs(dx) > Math.abs(dy)
                : dy > 0 && Math.abs(dy) > Math.abs(dx);
          if (!axisMatches) {
            active = false;
            detachWindow();
            return;
          }
          locked = true;
        }

        const raw =
          direction === "-x"
            ? Math.min(0, dx)
            : direction === "+x"
              ? Math.max(0, dx)
              : Math.max(0, dy);
        offset = raw;
        targetEl.style.transform = isHorizontal
          ? `translate3d(${raw}px, 0, 0)`
          : `translate3d(0, ${raw}px, 0)`;
      };

      const finishSwipe = () => {
        detachWindow();
        if (!active) return;
        const wasLocked = locked;
        const finalOffset = offset;
        const elapsed = Math.max(1, performance.now() - startTime);
        active = false;
        locked = false;
        offset = 0;

        if (!wasLocked) return;

        const velocity = Math.abs(finalOffset) / elapsed;
        const shouldClose = Math.abs(finalOffset) >= threshold || velocity > 0.35;
        targetEl.style.transform = "";

        if (shouldClose) {
          onDismissRef.current?.();
          return;
        }

        if (typeof targetEl.animate === "function") {
          const from = isHorizontal
            ? `translate3d(${finalOffset}px, 0, 0)`
            : `translate3d(0, ${finalOffset}px, 0)`;
          targetEl.animate([{ transform: from }, { transform: "translate3d(0, 0, 0)" }], {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        active = true;
        locked = false;
        startX = e.clientX;
        startY = e.clientY;
        startTime = performance.now();
        offset = 0;
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerup", finishSwipe);
        window.addEventListener("pointercancel", finishSwipe);
      };

      downEl.addEventListener("pointerdown", onPointerDown, { passive: true });
      cleanupListeners = () => {
        downEl.removeEventListener("pointerdown", onPointerDown);
        detachWindow();
        targetEl.style.transform = "";
      };
    };

    attach();

    return () => {
      disposed = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      cleanupListeners?.();
    };
  }, [direction, enabled, handleRef, targetRef, threshold]);
}
