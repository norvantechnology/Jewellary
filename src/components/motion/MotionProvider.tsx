"use client";

import * as React from "react";
import { LazyMotion, MotionConfig } from "motion/react";

/** Async feature bundle loaded outside initial entry chunk (tree-shaken via dedicated module). */
const loadDomAnimation = () => import("@/lib/motion-features").then((mod) => mod.default);

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Global MotionProvider configuring LazyMotion strict mode and user reduced-motion adherence.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={loadDomAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
