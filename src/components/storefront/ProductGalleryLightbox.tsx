"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 1.5;
const DOUBLE_TAP_SCALE = 2.5;

interface View {
  scale: number;
  x: number;
  y: number;
}
const RESET: View = { scale: 1, x: 0, y: 0 };

/**
 * Full-screen image viewer: pinch / double-tap / wheel to zoom, drag to pan when zoomed,
 * swipe (or arrow keys) to change photo when not zoomed.
 */
export function ProductGalleryLightbox({
  open,
  onOpenChange,
  images,
  selectedIndex,
  onSelectIndex,
  productName,
}: ProductGalleryLightboxProps) {
  const ui = useUiText();
  const t = ui.product.gallery;
  const count = images.length;
  const activeImage = images[selectedIndex] ?? images[0];

  const [view, setView] = React.useState<View>(RESET);
  const [dragging, setDragging] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<{
    startView: View;
    startX: number;
    startY: number;
    startDist: number;
    moved: boolean;
    lastTap: number;
  }>({ startView: RESET, startX: 0, startY: 0, startDist: 0, moved: false, lastTap: 0 });

  // New photo or reopened viewer: start un-zoomed.
  const viewKey = `${open}:${selectedIndex}`;
  const [lastKey, setLastKey] = React.useState(viewKey);
  if (lastKey !== viewKey) {
    setLastKey(viewKey);
    setView(RESET);
  }

  const go = React.useCallback(
    (delta: number) => {
      if (count > 1) onSelectIndex((selectedIndex + delta + count) % count);
    },
    [count, onSelectIndex, selectedIndex],
  );

  /** Keeps the zoomed image covering the frame (no empty gaps when panning). */
  const clamp = React.useCallback((next: View): View => {
    const el = stageRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    if (!el || scale === 1) return { scale, x: 0, y: 0 };
    const maxX = (el.clientWidth * (scale - 1)) / 2;
    const maxY = (el.clientHeight * (scale - 1)) / 2;
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  /** Zoom toward a point (client coords) so the spot under the finger/cursor stays put. */
  const zoomAt = React.useCallback(
    (targetScale: number, clientX?: number, clientY?: number, from: View = view) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (clientX ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
      const py = (clientY ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
      const ratio = scale / from.scale;
      setView(clamp({ scale, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio }));
    },
    [clamp, view],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomAt(view.scale * STEP);
      else if (e.key === "-") zoomAt(view.scale / STEP);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, zoomAt, view.scale]);

  // Wheel / trackpad zoom (non-passive so the page itself doesn't scroll).
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      setView((v) => {
        const rect = el.getBoundingClientRect();
        const px = e.clientX - (rect.left + rect.width / 2);
        const py = e.clientY - (rect.top + rect.height / 2);
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const ratio = scale / v.scale;
        return clamp({ scale, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, clamp, activeImage?.id]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    g.startView = view;
    g.moved = false;
    if (pts.length === 2) {
      g.startDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      g.startX = (pts[0]!.x + pts[1]!.x) / 2;
      g.startY = (pts[0]!.y + pts[1]!.y) / 2;
    } else {
      g.startX = e.clientX;
      g.startY = e.clientY;
    }
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2 && g.startDist > 0) {
      // Pinch zoom around the midpoint between the two fingers.
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const midX = (pts[0]!.x + pts[1]!.x) / 2;
      const midY = (pts[0]!.y + pts[1]!.y) / 2;
      g.moved = true;
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = g.startX - (rect.left + rect.width / 2);
      const py = g.startY - (rect.top + rect.height / 2);
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, g.startView.scale * (dist / g.startDist)),
      );
      const ratio = scale / g.startView.scale;
      setView(
        clamp({
          scale,
          x: px - (px - g.startView.x) * ratio + (midX - g.startX),
          y: py - (py - g.startView.y) * ratio + (midY - g.startY),
        }),
      );
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    if (g.startView.scale > 1) {
      setView(clamp({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // One finger lifted after a pinch: continue as a pan from here.
      const [rest] = [...pointers.current.values()];
      g.startView = view;
      g.startX = rest!.x;
      g.startY = rest!.y;
      g.startDist = 0;
      return;
    }
    setDragging(false);
    if (!wasSingle) return;

    const dx = e.clientX - g.startX;
    // Swipe between photos when not zoomed.
    if (g.startView.scale === 1 && Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (!g.moved) {
      const now = performance.now();
      const isMouse = e.pointerType === "mouse";
      if (isMouse || now - g.lastTap < 300) {
        // Click (mouse) or double-tap (touch): toggle zoom at that spot.
        zoomAt(view.scale > 1 ? 1 : DOUBLE_TAP_SCALE, e.clientX, e.clientY);
        g.lastTap = 0;
      } else {
        g.lastTap = now;
      }
    }
  }

  if (!activeImage) return null;
  const zoomed = view.scale > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:inset-0 sm:top-0 sm:left-0 sm:h-dvh sm:max-h-dvh sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:p-0">
        <div className="safe-area-pt flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pr-16 sm:px-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-display text-base font-semibold sm:text-lg">
              {productName}
            </DialogTitle>
            <DialogDescription className="sr-only">{activeImage.altText}</DialogDescription>
          </div>
          {count > 1 && (
            <span className="tabular-nums-price shrink-0 text-sm text-text-muted">
              {fill(t.counter, { current: selectedIndex + 1, total: count })}
            </span>
          )}
        </div>

        <div className="relative min-h-0 flex-1 bg-muted">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "absolute inset-0 touch-none overflow-hidden select-none",
              zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 will-change-transform",
                !dragging && "transition-transform duration-200 ease-out",
              )}
              style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
            >
              <Image
                key={activeImage.id}
                src={activeImage.url}
                alt={activeImage.altText}
                fill
                draggable={false}
                sizes="100vw"
                quality={90}
                className="object-contain"
              />
            </div>
          </div>

          {count > 1 && !zoomed && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t.lightboxPrevious}
                className="transition-ui absolute top-1/2 left-3 z-10 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-sm backdrop-blur-sm hover:border-accent sm:inline-flex"
              >
                <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t.lightboxNext}
                className="transition-ui absolute top-1/2 right-3 z-10 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-sm backdrop-blur-sm hover:border-accent sm:inline-flex"
              >
                <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </>
          )}

          <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => zoomAt(view.scale / STEP)}
              disabled={!zoomed}
              aria-label={t.zoomOut}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
            >
              <ZoomOut className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => zoomAt(view.scale * STEP)}
              disabled={view.scale >= MAX_SCALE}
              aria-label={t.zoomIn}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
            >
              <ZoomIn className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            {zoomed && (
              <button
                type="button"
                onClick={() => setView(RESET)}
                aria-label={t.zoomReset}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-text hover:bg-surface-2"
              >
                <RotateCcw className="size-4.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>

          {!zoomed && (
            <p className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-full bg-surface/90 px-3 py-1 text-xs text-text-muted shadow-sm sm:block">
              {t.zoomHintDesktop}
            </p>
          )}
          {!zoomed && (
            <p className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-surface/90 px-3 py-1 text-xs text-text-muted shadow-sm sm:hidden">
              {t.zoomHintTouch}
            </p>
          )}
        </div>

        {count > 1 && (
          <div className="safe-area-pb shrink-0 border-t border-border bg-background px-3 py-2.5 sm:px-6">
            <div className="flex scrollbar-none gap-2 overflow-x-auto sm:justify-center">
              {images.map((image, idx) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  aria-label={fill(t.viewImage, { number: idx + 1, alt: image.altText })}
                  aria-current={idx === selectedIndex ? "true" : undefined}
                  className={cn(
                    "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition-opacity sm:size-16",
                    idx === selectedIndex
                      ? "border-accent"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <Image
                    src={image.thumbUrl ?? image.mediumUrl ?? image.url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
