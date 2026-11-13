"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={4000}
      visibleToasts={3}
      closeButton={false}
      style={{ zIndex: "var(--z-toast)" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-surface !text-text !shadow-md !px-4 !py-3 !text-sm !items-center !gap-2.5",
          title: "!text-sm !font-medium !leading-snug",
          description: "!text-xs !text-text-muted",
          success: "!border-success/40",
          error: "!border-danger/45",
          actionButton:
            "!bg-primary !text-on-primary !rounded-md !text-xs !font-medium !px-2.5 !py-1",
          cancelButton: "!bg-surface-3 !text-text !rounded-md !text-xs !px-2.5 !py-1",
        },
      }}
    />
  );
}
