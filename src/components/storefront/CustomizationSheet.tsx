"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import { CustomizeForm } from "@/components/storefront/customize/CustomizeForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import {
  ATELIER_CHAT_EVENT,
  ATELIER_CUSTOMIZE_EVENT,
  consumePendingAtelierCustomization,
  type OpenCustomizationEventDetail,
} from "@/lib/atelier-events";
import type { ProductCustomizationSchemaDTO } from "@/modules/customization/customization.service";

/**
 * Global storefront customization sheet:
 * - >=768px: 520px right drawer with 3-step flow
 * - <768px: full-screen 100dvh sheet with sticky header & sticky footer
 */
export function CustomizationSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [slug, setSlug] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [schema, setSchema] = React.useState<ProductCustomizationSchemaDTO | null>(null);
  const [isSideDrawer, setIsSideDrawer] = React.useState(true);
  const [isDirty, setIsDirty] = React.useState(false);

  const guard = useUnsavedChangesGuard({
    isDirty: open && isDirty,
    title: "Discard customization?",
    description: "You have unsaved customization selections. Leaving now will discard them.",
  });

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsSideDrawer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (open) {
      document.documentElement.dataset.customizeDrawerOpen = "true";
    } else {
      delete document.documentElement.dataset.customizeDrawerOpen;
    }
    window.dispatchEvent(new CustomEvent("atelier:customize-drawer-toggle", { detail: { open } }));
    return () => {
      delete document.documentElement.dataset.customizeDrawerOpen;
    };
  }, [open]);

  React.useEffect(() => {
    const openForSlug = (targetSlug: string) => {
      setSlug(targetSlug);
      setLoading(true);
      setErrorMsg(null);
      setSchema(null);
      setIsDirty(false);
      setOpen(true);
    };

    const handleOpen = (event: Event) => {
      const customEvent = event as CustomEvent<OpenCustomizationEventDetail>;
      const targetSlug = customEvent.detail?.productSlug;
      if (!targetSlug) return;
      consumePendingAtelierCustomization();
      openForSlug(targetSlug);
    };

    const handleChatOpen = () => {
      // Close customization sheet cleanly when user jumps to "Chat with the atelier"
      guard.markClean();
      setIsDirty(false);
      setOpen(false);
    };

    window.addEventListener(ATELIER_CUSTOMIZE_EVENT, handleOpen);
    window.addEventListener(ATELIER_CHAT_EVENT, handleChatOpen);

    const queued = consumePendingAtelierCustomization();
    if (queued?.productSlug) {
      openForSlug(queued.productSlug);
    }

    return () => {
      window.removeEventListener(ATELIER_CUSTOMIZE_EVENT, handleOpen);
      window.removeEventListener(ATELIER_CHAT_EVENT, handleChatOpen);
    };
  }, [guard]);

  React.useEffect(() => {
    if (!open || !slug) return;
    let active = true;

    fetch(`/api/customizations/products/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Unable to load customization options.");
        }
        return json as ProductCustomizationSchemaDTO;
      })
      .then((data) => {
        if (!active) return;
        if (!data.enabled) {
          setErrorMsg("Bespoke customization is currently unavailable for this piece.");
          return;
        }
        setSchema(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load options.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, slug]);

  function closeImmediately() {
    setIsDirty(false);
    setOpen(false);
  }

  function handleRequestClose() {
    guard.confirmLeave(closeImmediately);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      handleRequestClose();
      return;
    }
    setOpen(true);
  }

  function handleOpenFullPage() {
    if (!schema) return;
    guard.confirmLeave(() => {
      guard.markClean();
      setIsDirty(false);
      setOpen(false);
      router.push(`/products/${schema.productSlug}/customize`);
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          data-customize-drawer={open ? "true" : "false"}
          side={isSideDrawer ? "right" : "bottom"}
          showDragHandle={false}
          hideClose
          transformOnly250
          enableHorizontalDrag={false}
          overlayClassName="bg-overlay backdrop-blur-[1.5px]"
          className={
            isSideDrawer
              ? "flex h-dvh max-h-dvh w-[480px] max-w-[92vw] flex-col gap-0 overflow-hidden rounded-l-2xl rounded-r-none border-y-0 border-r-0 border-l border-border bg-card p-0 pb-0 shadow-2xl sm:w-[480px] sm:max-w-[92vw] sm:p-0 lg:w-[520px] lg:max-w-[92vw]"
              : "flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-0 bg-card p-0 pb-0 shadow-2xl sm:p-0"
          }
        >
          <SheetTitle className="sr-only">
            {schema ? `Customize ${schema.productName}` : "Customize piece"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Choose bespoke options and send a customization request for an official quote.
          </SheetDescription>

          {loading ? (
            <div className="flex h-full flex-col">
              <div className="safe-area-pt flex items-center justify-between border-b border-border px-5 py-3 sm:px-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-accent-text" aria-hidden="true" />
                  <span>Loading customization options...</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeImmediately}
                  aria-label="Close customization drawer"
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex-1 space-y-5 p-4 sm:p-6">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            </div>
          ) : errorMsg ? (
            <div className="flex h-full flex-col">
              <div className="safe-area-pt flex items-center justify-end border-b border-border px-4 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeImmediately}
                  aria-label="Close customization drawer"
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <Sparkles className="size-8 stroke-[1.5] text-accent-text" aria-hidden="true" />
                <p className="mt-3 max-w-sm text-sm text-muted-foreground">{errorMsg}</p>
                <Button type="button" variant="outline" onClick={closeImmediately} className="mt-5">
                  Close
                </Button>
              </div>
            </div>
          ) : schema ? (
            <CustomizeForm
              schema={schema}
              variant="drawer"
              onCancel={handleRequestClose}
              onOpenFullPage={handleOpenFullPage}
              onDirtyChange={setIsDirty}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {guard.dialog}
    </>
  );
}
