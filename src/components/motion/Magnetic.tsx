"use client";

import * as React from "react";
import { useIsLowEndDevice, useIsTouchDevice, useReducedMotionSafe } from "@/lib/motion";

interface MagneticProps {
  children: React.ReactNode;
  strength?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Subtle desktop-only pointer attraction helper (no React re-renders on pointermove).
 */
export function Magnetic({ children, strength = 5, disabled = false, className }: MagneticProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionSafe();
  const isTouch = useIsTouchDevice();
  const lowEnd = useIsLowEndDevice();
  const frameRef = React.useRef<number | null>(null);

  const active = !disabled && !reducedMotion && !isTouch && !lowEnd;

  React.useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active || event.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const relX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const relY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const tx = Math.max(-1, Math.min(1, relX)) * strength;
    const ty = Math.max(-1, Math.min(1, relY)) * strength;

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      }
    });
  };

  const handlePointerLeave = () => {
    if (!ref.current) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    ref.current.style.transform = "translate3d(0, 0, 0)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={active ? handlePointerMove : undefined}
      onPointerLeave={active ? handlePointerLeave : undefined}
      className={className}
      style={
        active
          ? {
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
