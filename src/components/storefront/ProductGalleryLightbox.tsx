"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PublicImageDTO } from "@/modules/catalog/catalog.public";

interface ProductGalleryLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: PublicImageDTO[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  productName: string;
}

export function ProductGalleryLightbox({
  open,
  onOpenChange,
  images,
  selectedIndex,
  onSelectIndex,
  productName,
}: ProductGalleryLightboxProps) {
  const ui = useUiText();
  const zoomKey = `${open}:${selectedIndex}`;
  const [zoomedKey, setZoomedKey] = React.useState<string | null>(null);
  const zoomed = open && zoomedKey === zoomKey;
  const toggleZoom = () => setZoomedKey((prev) => (prev === zoomKey ? null : zoomKey));

  const activeImage = images[selectedIndex] ?? images[0];
  if (!activeImage) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold sm:text-xl">
            {productName}
          </DialogTitle>
          <DialogDescription>{activeImage.altText}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] w-full [touch-action:pinch-zoom_pan-x_pan-y] overflow-auto rounded-xl border border-border bg-muted">
          <div
            role="button"
            tabIndex={0}
            aria-label={zoomed ? "Zoom out image" : "Zoom in image"}
            onClick={toggleZoom}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleZoom();
              }
            }}
            className={cn(
              "relative h-full w-full transition-transform duration-200 ease-out focus-visible:outline-none",
              zoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in",
            )}
          >
            <Image
              src={activeImage.url}
              alt={activeImage.altText}
              fill
              sizes="(max-width: 1024px) 95vw, 900px"
              className="object-contain dark:brightness-90"
            />
          </div>
          <button
            type="button"
            onClick={toggleZoom}
            aria-label={zoomed ? "Reset zoom" : "Zoom image"}
            className="transition-ui absolute right-3 bottom-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-sm backdrop-blur-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {zoomed ? (
              <ZoomOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ZoomIn className="size-5" strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
        {images.length > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => onSelectIndex((selectedIndex - 1 + images.length) % images.length)}
              className="transition-ui inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent sm:px-4"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
              <span>{ui.product.gallery.lightboxPrevious}</span>
            </button>
            <span className="tabular-nums-price text-sm text-text-muted">
              {selectedIndex + 1} of {images.length}
            </span>
            <button
              type="button"
              onClick={() => onSelectIndex((selectedIndex + 1) % images.length)}
              className="transition-ui inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent sm:px-4"
            >
              <span>{ui.product.gallery.lightboxNext}</span>
              <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
