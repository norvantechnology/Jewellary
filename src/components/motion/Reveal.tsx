"use client";

import * as React from "react";
import {
  MOTION_TRAVEL,
  useInViewOnce,
  useIsLowEndDevice,
  useReducedMotionSafe,
} from "@/lib/motion";

type RevealVariant = "up" | "fade" | "scale";
type RevealTag = "div" | "section" | "article" | "li" | "span";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: RevealVariant;
  delayMs?: number;
  durationMs?: number;
  travelPx?: number;
  disabled?: boolean;
  as?: RevealTag;
}

/**
 * Progressive scroll-triggered reveal leaf (CSS-first + IntersectionObserver once).
 * Never hides SSR markup with opacity: 0 on initial HTML render.
 */
export function Reveal({
  children,
  className,
  style,
  variant = "up",
  delayMs = 0,
  durationMs = 350,
  travelPx = MOTION_TRAVEL,
  disabled = false,
  as = "div",
}: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotionSafe();
  const lowEnd = useIsLowEndDevice();

  useInViewOnce(ref, {
    disabled: disabled || lowEnd,
    mode: "reveal",
  });

  const mergedStyle: React.CSSProperties = {
    ...style,
    ["--ma-delay" as string]: `${reducedMotion ? 0 : delayMs}ms`,
    ["--ma-duration" as string]: `${reducedMotion ? 120 : durationMs}ms`,
    ["--ma-travel" as string]: `${reducedMotion ? 0 : travelPx}px`,
  };

  const dataVariant = reducedMotion ? "fade" : variant;

  const setRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  switch (as) {
    case "section":
      return (
        <section
          ref={setRef}
          data-ma-variant={dataVariant}
          className={className}
          style={mergedStyle}
        >
          {children}
        </section>
      );
    case "article":
      return (
        <article
          ref={setRef}
          data-ma-variant={dataVariant}
          className={className}
          style={mergedStyle}
        >
          {children}
        </article>
      );
    case "li":
      return (
        <li ref={setRef} data-ma-variant={dataVariant} className={className} style={mergedStyle}>
          {children}
        </li>
      );
    case "span":
      return (
        <span ref={setRef} data-ma-variant={dataVariant} className={className} style={mergedStyle}>
          {children}
        </span>
      );
    default:
      return (
        <div ref={setRef} data-ma-variant={dataVariant} className={className} style={mergedStyle}>
          {children}
        </div>
      );
  }
}

type RevealStaggerTag = "div" | "ol" | "ul" | "section";

interface RevealStaggerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  as?: RevealStaggerTag;
}

/**
 * Staggers the first 8 direct children by 60ms using GPU transform + opacity CSS transitions.
 * Preserves Server Component children untouched inside grid/list containers.
 */
export function RevealStagger({
  children,
  className,
  style,
  disabled = false,
  as = "div",
}: RevealStaggerProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const lowEnd = useIsLowEndDevice();

  useInViewOnce(ref, {
    disabled: disabled || lowEnd,
    mode: "stagger",
  });

  const setRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  switch (as) {
    case "ol":
      return (
        <ol ref={setRef} className={className} style={style}>
          {children}
        </ol>
      );
    case "ul":
      return (
        <ul ref={setRef} className={className} style={style}>
          {children}
        </ul>
      );
    case "section":
      return (
        <section ref={setRef} className={className} style={style}>
          {children}
        </section>
      );
    default:
      return (
        <div ref={setRef} className={className} style={style}>
          {children}
        </div>
      );
  }
}

interface RevealItemProps {
  children: React.ReactNode;
  index?: number;
  maxItems?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: RevealTag;
}

/**
 * Individual staggered item helper (staggers up to maxItems, default 8; remainder render instantly).
 */
export function RevealItem({
  children,
  index = 0,
  maxItems = 8,
  className,
  style,
  as = "div",
}: RevealItemProps) {
  if (index >= maxItems) {
    return (
      <Reveal as={as} disabled className={className} style={style}>
        {children}
      </Reveal>
    );
  }

  return (
    <Reveal as={as} delayMs={index * 60} durationMs={320} className={className} style={style}>
      {children}
    </Reveal>
  );
}

export function FadeIn({
  children,
  delayMs = 0,
  durationMs = 250,
  className,
  style,
  disabled = false,
  as = "div",
}: Omit<RevealProps, "variant" | "travelPx">) {
  return (
    <Reveal
      as={as}
      variant="fade"
      delayMs={delayMs}
      durationMs={durationMs}
      travelPx={0}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </Reveal>
  );
}

export function ScaleIn({
  children,
  delayMs = 0,
  durationMs = 250,
  className,
  style,
  disabled = false,
  as = "div",
}: Omit<RevealProps, "variant" | "travelPx">) {
  return (
    <Reveal
      as={as}
      variant="scale"
      delayMs={delayMs}
      durationMs={durationMs}
      travelPx={0}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </Reveal>
  );
}
