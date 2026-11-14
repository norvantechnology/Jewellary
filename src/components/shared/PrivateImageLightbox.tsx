"use client";

import { useModalHistory } from "@/hooks/use-modal-history";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

export interface LightboxImageItem {
  url: string;
  alt: string;
}

interface PrivateImageLightboxProps {
  images: LightboxImageItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex?: (nextIndex: number) => void;
}

export function PrivateImageLightbox({
  images,
  activeIndex,
  onClose,
  onChangeIndex,
}: PrivateImageLightboxProps) {
  const ui = useUiText();
  const [zoomedIndex, setZoomedIndex] = React.useState<number | null>(null);
  const zoomed = activeIndex !== null && zoomedIndex === activeIndex;
  // Phone Back closes the viewer instead of leaving the page.
  useModalHistory(activeIndex !== null, onClose);

  React.useEffect(() => {
    if (activeIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (
        e.key === "ArrowRight" &&
        activeIndex !== null &&
        onChangeIndex &&
        images.length > 1
      ) {
        onChangeIndex((activeIndex + 1) % images.length);
      } else if (
        e.key === "ArrowLeft" &&
        activeIndex !== null &&
        onChangeIndex &&
        images.length > 1
      ) {
        onChangeIndex((activeIndex - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length, onChangeIndex, onClose]);

  const current =
    activeIndex !== null && activeIndex >= 0 && activeIndex < images.length
      ? images[activeIndex]
      : null;

  return (
    <AnimatePresence>
      {current ? (
        <m.div
          key="private-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || ui.layout.imagePreview}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-6"
          onClick={onClose}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="truncate text-xs font-medium text-foreground">
                {current.alt}
                {images.length > 1 && activeIndex !== null
                  ? ` (${activeIndex + 1} / ${images.length})`
                  : ""}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomedIndex((z) => (z === activeIndex ? null : activeIndex))}
                  aria-label={zoomed ? ui.layout.imageResetZoom : ui.layout.imageZoomIn}
                  className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={ui.layout.imageClose}
                  className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-surface-2 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.alt}
                className={`max-h-[74vh] rounded-md object-contain transition-transform duration-200 ${
                  zoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"
                }`}
                onClick={() => setZoomedIndex((z) => (z === activeIndex ? null : activeIndex))}
              />

              {images.length > 1 && activeIndex !== null && onChangeIndex ? (
                <>
                  <button
                    type="button"
                    onClick={() => onChangeIndex((activeIndex - 1 + images.length) % images.length)}
                    aria-label={ui.layout.imagePrevious}
                    className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm hover:bg-card"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeIndex((activeIndex + 1) % images.length)}
                    aria-label={ui.layout.imageNext}
                    className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm hover:bg-card"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
