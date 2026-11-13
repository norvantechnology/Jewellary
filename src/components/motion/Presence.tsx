"use client";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import {
  drawerLeftVariants,
  drawerRightVariants,
  modalVariants,
  popoverVariants,
  sheetBottomVariants,
  useReducedMotionSafe,
  useSwipeDismiss,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

interface PresenceSurfaceProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

/** Animated left or right sliding drawer with optional horizontal swipe-to-dismiss. */
export function DrawerPresence({
  open,
  side = "right",
  onClose,
  children,
  className,
}: PresenceSurfaceProps & { side?: "left" | "right" }) {
  const reducedMotion = useReducedMotionSafe();
  const panelRef = React.useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, {
    direction: side === "left" ? "-x" : "+x",
    enabled: open && !reducedMotion && Boolean(onClose),
    threshold: 70,
    onDismiss: onClose,
  });

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panelRef}
          variants={side === "left" ? drawerLeftVariants : drawerRightVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(className)}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Animated bottom sheet with spring physics and swipe-down-to-dismiss. */
export function SheetPresence({ open, onClose, children, className }: PresenceSurfaceProps) {
  const reducedMotion = useReducedMotionSafe();
  const panelRef = React.useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, {
    direction: "+y",
    enabled: open && !reducedMotion && Boolean(onClose),
    threshold: 80,
    onDismiss: onClose,
  });

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panelRef}
          variants={sheetBottomVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(className)}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Animated modal entrance/exit wrapper. */
export function ModalPresence({
  open,
  children,
  className,
}: Omit<PresenceSurfaceProps, "onClose">) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(className)}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Animated popover/dropdown entrance/exit wrapper. */
export function PopoverPresence({
  open,
  children,
  className,
}: Omit<PresenceSurfaceProps, "onClose">) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(className)}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
