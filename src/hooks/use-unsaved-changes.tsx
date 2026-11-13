"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  title?: string;
  description?: string;
}

/**
 * Protects admin forms against accidental data loss on browser unload (`beforeunload`)
 * and in-app link navigation or custom discard actions via a confirmation dialog.
 * Call `markClean()` right before saving + navigating away to prevent false positives.
 */
export function useUnsavedChangesGuard({
  isDirty,
  title = "Discard unsaved changes?",
  description = "You have unsaved edits in this form. If you leave now, those changes will be lost.",
}: UseUnsavedChangesOptions) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const pendingActionRef = React.useRef<(() => void) | null>(null);
  const bypassRef = React.useRef(false);
  const isDirtyRef = React.useRef(isDirty);

  React.useEffect(() => {
    isDirtyRef.current = isDirty;
    if (!isDirty) {
      bypassRef.current = false;
    }
  }, [isDirty]);

  React.useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (bypassRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  React.useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!isDirtyRef.current || bypassRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;
      const nextRoute = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextRoute === currentRoute) return;

      event.preventDefault();
      event.stopPropagation();

      pendingActionRef.current = () => {
        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      };
      setConfirmOpen(true);
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [router]);

  const markClean = React.useCallback(() => {
    bypassRef.current = true;
    isDirtyRef.current = false;
  }, []);

  const confirmLeave = React.useCallback((action: () => void) => {
    if (!isDirtyRef.current || bypassRef.current) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setConfirmOpen(true);
  }, []);

  const handleConfirmDiscard = React.useCallback(() => {
    bypassRef.current = true;
    isDirtyRef.current = false;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setConfirmOpen(false);
    action?.();
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      pendingActionRef.current = null;
    }
    setConfirmOpen(open);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      confirmLabel="Discard Changes"
      cancelLabel="Keep Editing"
      destructive
      onConfirm={handleConfirmDiscard}
    />
  );

  return {
    confirmLeave,
    markClean,
    dialog,
  };
}
