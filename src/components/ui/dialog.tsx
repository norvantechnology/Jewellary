"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { keepOpenOnKeyboardEscape, useModalHistory } from "@/hooks/use-modal-history";
import { cn } from "@/lib/utils";

/** Radix Dialog root + native-like Back button handling (see useModalHistory). */
export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof RadixDialog.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  useModalHistory(open, () => handleOpenChange(false));
  return <RadixDialog.Root open={open} onOpenChange={handleOpenChange} {...props} />;
}
export const DialogTrigger = RadixDialog.Trigger;
export const DialogPortal = RadixDialog.Portal;
export const DialogClose = RadixDialog.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Overlay>) {
  return (
    <RadixDialog.Overlay
      className={cn(
        "ma-overlay fixed inset-0 z-[var(--z-modal)] bg-overlay backdrop-blur-[2px]",
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  hideClose = false,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof RadixDialog.Content> & { hideClose?: boolean }) {
  const ui = useUiText();
  return (
    <DialogPortal>
      <DialogOverlay />
      <RadixDialog.Content
        className={cn(
          "ma-dialog fixed right-0 bottom-0 left-0 z-[var(--z-modal)] grid max-h-[90dvh] w-full gap-4 overflow-y-auto rounded-t-[18px] border border-border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-popover-foreground shadow-md sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[540px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6",
          className,
        )}
        onEscapeKeyDown={(event) => {
          keepOpenOnKeyboardEscape(event);
          onEscapeKeyDown?.(event);
        }}
        {...props}
      >
        {children}
        {!hideClose && (
          <RadixDialog.Close
            aria-label={ui.common.closeDialog}
            className="transition-ui absolute top-3 right-3 z-20 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </DialogPortal>
  );
}

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-1.5 border-b border-border/70 bg-popover/95 px-4 pt-2.5 pb-3 text-left backdrop-blur-sm sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pr-10 sm:backdrop-blur-none",
        className,
      )}
      {...props}
    >
      <span className="mx-auto mb-1 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
      <div className="flex flex-col gap-1.5 pr-11 sm:pr-0">{children}</div>
    </div>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-popover/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:static sm:m-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title
      className={cn(
        "text-xl leading-[1.2] font-semibold tracking-[-0.015em] text-foreground sm:text-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
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
