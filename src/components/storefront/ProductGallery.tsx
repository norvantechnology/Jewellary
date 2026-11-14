"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, m } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, Gem } from "lucide-react";
import Image from "next/image";
import {
  fadeInVariants,
  MOTION_TRANSITIONS,
  useFlipIndicator,
  useReducedMotionSafe,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { PublicImageDTO } from "@/modules/catalog/catalog.public";

const LazyProductGalleryLightbox = dynamic(
  () =>
    import("@/components/storefront/ProductGalleryLightbox").then((m) => m.ProductGalleryLightbox),
  { ssr: false },
);

interface ProductGalleryProps {
  images: PublicImageDTO[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const ui = useUiText();
  const reducedMotion = useReducedMotionSafe();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [hasOpenedLightbox, setHasOpenedLightbox] = React.useState(false);
  const [showMobileHint, setShowMobileHint] = React.useState(true);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const didSwipeRef = React.useRef(false);
  const swipeRef = React.useRef<{
    startX: number;
    startY: number;
    startTime: number;
    active: boolean;
    locked: "h" | "v" | null;
    lastDx: number;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    active: false,
    locked: null,
    lastDx: 0,
  });

  const count = images.length;

  useFlipIndicator(thumbsRef, selectedIndex, reducedMotion);

  React.useEffect(() => {
    if (reducedMotion || !showMobileHint) return;
    const timer = window.setTimeout(() => setShowMobileHint(false), 3200);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, showMobileHint]);

  function selectSlide(index: number) {
    if (count === 0) return;
    setShowMobileHint(false);
    setSelectedIndex(((index % count) + count) % count);
  }

  function handleOpenLightbox() {
    setShowMobileHint(false);
    setHasOpenedLightbox(true);
    setLightboxOpen(true);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    didSwipeRef.current = false;
    if (count <= 1) return;
    swipeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      active: true,
      locked: null,
      lastDx: 0,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = swipeRef.current;
    if (!state.active || count <= 1) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) > 8) {
      didSwipeRef.current = true;
    }

    if (state.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      state.locked = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
    }

    if (state.locked !== "h" || reducedMotion) return;
    state.lastDx = dx;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${dx * 0.72}px, 0, 0)`;
    }
  }

  function finishSwipe() {
    const state = swipeRef.current;
    if (!state.active) return;
    const { locked, lastDx, startTime } = state;
    state.active = false;
    state.locked = null;
    state.lastDx = 0;

    if (locked !== "h") return;

    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = lastDx / elapsed;
    const didSwipe = Math.abs(lastDx) > 40 || Math.abs(velocity) > 0.35;

    if (stageRef.current) {
      const fromX = lastDx * 0.72;
      stageRef.current.style.transform = "";
      if (!reducedMotion && Math.abs(fromX) > 2 && typeof stageRef.current.animate === "function") {
        stageRef.current.animate(
          [{ transform: `translate3d(${fromX}px, 0, 0)` }, { transform: "translate3d(0, 0, 0)" }],
          {
            duration: 240,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
      }
    }

    if (didSwipe && count > 1) {
      selectSlide(lastDx < 0 ? selectedIndex + 1 : selectedIndex - 1);
    }
  }

  if (count === 0) {
    return (
      <div
        role="img"
        aria-label={productName}
        className="flex aspect-[4/5] items-center justify-center rounded-lg border border-border bg-muted"
      >
        <Gem className="size-10 text-muted-foreground/45" strokeWidth={1.25} aria-hidden="true" />
      </div>
    );
  }

  const activeImage = images[selectedIndex] ?? images[0];
  if (!activeImage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="group relative overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
        <div
          ref={stageRef}
          className="relative aspect-[4/5] cursor-zoom-in touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishSwipe}
          onPointerCancel={finishSwipe}
          onClick={() => {
            if (!didSwipeRef.current) handleOpenLightbox();
          }}
        >
          {images.map((image, idx) => {
            const isSeed = image.url.startsWith("/images/seed/");
            const isActive = idx === selectedIndex;
            return (
              <m.div
                key={image.id}
                data-pdp-active-image={isActive ? "true" : undefined}
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  scale: !reducedMotion && !isActive ? 0.992 : 1,
                }}
                transition={reducedMotion ? MOTION_TRANSITIONS.reduced : MOTION_TRANSITIONS.base}
                aria-hidden={!isActive}
                className={cn("absolute inset-0", isActive ? "z-10" : "pointer-events-none z-0")}
              >
                <Image
                  src={image.url}
                  alt={image.altText}
                  fill
                  preload={idx === 0}
                  fetchPriority={idx === 0 ? "high" : undefined}
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className={cn(
                    "object-cover select-none",
                    isSeed ? "object-cover object-center dark:brightness-90" : "object-center",
                  )}
                />
              </m.div>
            );
          })}
        </div>

        <AnimatePresence>
          {showMobileHint && !reducedMotion ? (
            <m.span
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-none absolute top-3 right-3 z-20 rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground/85 shadow-sm backdrop-blur-sm sm:hidden"
            >
              {count > 1 ? ui.product.gallery.swipeHint : ui.product.gallery.tapHint}
            </m.span>
          ) : null}
        </AnimatePresence>

        <span className="pointer-events-none absolute right-16 bottom-3 z-20 hidden rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-medium text-foreground/85 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 sm:inline-flex">
          {ui.product.gallery.clickToZoom}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLightbox();
          }}
          aria-label={ui.product.gallery.openViewer}
          className="transition-ui absolute right-3 bottom-3 z-20 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text shadow-sm backdrop-blur-sm hover:border-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Expand className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectSlide(selectedIndex - 1);
              }}
              aria-label={ui.product.gallery.previous}
              className="transition-ui absolute top-1/2 left-2.5 z-20 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/90 text-text shadow-sm backdrop-blur-sm hover:border-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:left-3"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectSlide(selectedIndex + 1);
              }}
              aria-label={ui.product.gallery.next}
              className="transition-ui absolute top-1/2 right-2.5 z-20 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface/90 text-text shadow-sm backdrop-blur-sm hover:border-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-3"
            >
              <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <div className="tabular-nums-price pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-text shadow-sm backdrop-blur-sm">
              <span aria-hidden="true" className="flex items-center gap-1">
                {images.slice(0, 6).map((image, idx) => (
                  <span
                    key={image.id}
                    className={cn(
                      "rounded-full transition-all",
                      idx === selectedIndex ? "h-1.5 w-3 bg-accent" : "size-1.5 bg-text/30",
                    )}
                  />
                ))}
              </span>
              <span>
                {selectedIndex + 1} / {count}
              </span>
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          ref={thumbsRef}
          className="flex scrollbar-none gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:pb-0"
        >
          {images.map((image, idx) => {
            const active = idx === selectedIndex;
            const thumbSrc = image.thumbUrl ?? image.mediumUrl ?? image.url;
            const isSeed = thumbSrc.startsWith("/images/seed/");
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => selectSlide(idx)}
                aria-label={fill(ui.product.gallery.viewImage, {
                  number: idx + 1,
                  alt: image.altText,
                })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "ma-media-placeholder transition-ui relative aspect-square size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:size-auto sm:w-full",
                  active
                    ? "border-accent ring-1 ring-accent"
                    : "border-border opacity-80 hover:opacity-100",
                )}
              >
                <Image
                  src={thumbSrc}
                  alt=""
                  fill
                  sizes="110px"
                  className={cn(
                    "object-cover",
                    isSeed ? "object-cover object-center dark:brightness-90" : "object-center",
                  )}
                />
                {active ? (
                  <span
                    data-ma-indicator="true"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-md border-2 border-accent ring-2 ring-ring ring-inset"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {hasOpenedLightbox ? (
        <LazyProductGalleryLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={images}
          selectedIndex={selectedIndex}
          onSelectIndex={selectSlide}
          productName={productName}
        />
      ) : null}
    </div>
  );
}
