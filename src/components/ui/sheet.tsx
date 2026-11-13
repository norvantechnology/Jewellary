"use client";

import * as React from "react";
import { X } from "lucide-react";
import { AnimatePresence, m, useDragControls, type PanInfo } from "motion/react";
import { Dialog as RadixDialog } from "radix-ui";
import {
  drawerLeftVariants,
  drawerRightVariants,
  fadeInVariants,
  MOTION_EASE,
  MOTION_TRANSITIONS,
  sheetBottomVariants,
  useReducedMotionSafe,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

interface SheetContextValue {
  open: boolean;
  onClose: () => void;
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  onClose: () => {},
});

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof RadixDialog.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({ open, onClose: () => handleOpenChange(false) }),
    [open, handleOpenChange],
  );

  return (
    <SheetContext.Provider value={contextValue}>
      <RadixDialog.Root open={open} onOpenChange={handleOpenChange} {...props} />
    </SheetContext.Provider>
  );
}

export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;
export const SheetPortal = RadixDialog.Portal;

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Overlay>) {
  return (
    <RadixDialog.Overlay
      className={cn("fixed inset-0 z-[var(--z-drawer)] bg-overlay backdrop-blur-[2px]", className)}
      {...props}
    />
  );
}

const SHEET_SIDE_CLASSES = {
  left: "inset-y-0 left-0 h-dvh w-[min(86vw,360px)] border-r",
  right: "inset-y-0 right-0 h-dvh w-full border-l sm:w-[400px] sm:max-w-[400px]",
  top: "inset-x-0 top-0 max-h-[90dvh] w-full rounded-b-[18px] border-b",
  bottom: "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[20px] border-t",
} as const;

export interface SheetContentProps extends React.ComponentProps<typeof RadixDialog.Content> {
  side?: keyof typeof SHEET_SIDE_CLASSES;
  showDragHandle?: boolean;
  hideClose?: boolean;
  overlayClassName?: string;
  transformOnly250?: boolean;
  enableHorizontalDrag?: boolean;
}

export function SheetContent({
  side = "right",
  showDragHandle = false,
  hideClose = false,
  overlayClassName,
  transformOnly250 = false,
  enableHorizontalDrag = true,
  className,
  children,
  ...props
}: SheetContentProps) {
  const { open, onClose } = React.useContext(SheetContext);
  const reducedMotion = useReducedMotionSafe();
  const dragControls = useDragControls();

  const panelVariants = reducedMotion
    ? fadeInVariants
    : transformOnly250
      ? {
          hidden:
            side === "right"
              ? { x: "100%" }
              : side === "left"
                ? { x: "-100%" }
                : side === "top"
                  ? { y: "-100%" }
                  : { y: "100%" },
          visible: {
            x: 0,
            y: 0,
            transition: { duration: 0.25, ease: MOTION_EASE.out },
          },
          exit: {
            ...(side === "right"
              ? { x: "100%" }
              : side === "left"
                ? { x: "-100%" }
                : side === "top"
                  ? { y: "-100%" }
                  : { y: "100%" }),
            transition: { duration: 0.2, ease: MOTION_EASE.inOut },
          },
        }
      : side === "left"
        ? drawerLeftVariants
        : side === "bottom"
          ? sheetBottomVariants
          : side === "right"
            ? drawerRightVariants
            : fadeInVariants;

  const isHorizontal = side === "left" || side === "right";
  const dragAxis = reducedMotion
    ? false
    : isHorizontal && enableHorizontalDrag
      ? ("x" as const)
      : side === "bottom"
        ? ("y" as const)
        : false;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (side === "left" && (info.offset.x < -72 || info.velocity.x < -280)) {
      onClose();
    } else if (side === "right" && (info.offset.x > 72 || info.velocity.x > 280)) {
      onClose();
    } else if (side === "bottom" && (info.offset.y > 76 || info.velocity.y > 280)) {
      onClose();
    }
  };

  return (
    <SheetPortal forceMount>
      <AnimatePresence>
        {open && (
          <>
            <RadixDialog.Overlay forceMount asChild>
              <m.div
                key="sheet-backdrop"
                variants={fadeInVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={reducedMotion ? MOTION_TRANSITIONS.reduced : MOTION_TRANSITIONS.fast}
                className={cn(
                  "fixed inset-0 z-[var(--z-drawer)] bg-overlay backdrop-blur-[2px]",
                  overlayClassName,
                )}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content forceMount asChild {...props}>
              <m.div
                key="sheet-content"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                drag={dragAxis}
                dragListener={isHorizontal}
                dragControls={side === "bottom" ? dragControls : undefined}
                dragDirectionLock
                dragElastic={isHorizontal ? 0.08 : { top: 0, bottom: 0.2 }}
                dragMomentum={false}
                dragConstraints={
                  side === "left"
                    ? { left: -280, right: 0 }
                    : side === "right"
                      ? { left: 0, right: 280 }
                      : side === "bottom"
                        ? { top: 0, bottom: 260 }
                        : undefined
                }
                onDragEnd={dragAxis ? handleDragEnd : undefined}
                className={cn(
                  "fixed z-[var(--z-drawer)] flex flex-col gap-4 bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-popover-foreground shadow-md outline-none sm:p-6",
                  SHEET_SIDE_CLASSES[side],
                  className,
                )}
              >
                {showDragHandle && side === "bottom" && (
                  <div
                    onPointerDown={(e) => {
                      if (!reducedMotion) dragControls.start(e);
                    }}
                    className="flex shrink-0 cursor-grab touch-none justify-center pt-1 pb-2 active:cursor-grabbing"
                    aria-hidden="true"
                  >
                    <span className="h-1 w-10 rounded-full bg-border" />
                  </div>
                )}
                {children}
                {!hideClose && (
                  <RadixDialog.Close
                    aria-label="Close panel"
                    className="transition-ui absolute top-3 right-3 z-20 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  </RadixDialog.Close>
                )}
              </m.div>
            </RadixDialog.Content>
          </>
        )}
      </AnimatePresence>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 pr-10 text-left", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title
      className={cn("font-display text-lg font-medium tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
