"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PublicImageDTO } from "@/modules/catalog/catalog.public";

interface ProductGalleryProps {
  images: PublicImageDTO[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1 });
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  function selectSlide(index: number) {
    setSelectedIndex(index);
    emblaApi?.scrollTo(index);
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-border bg-muted text-sm text-muted-foreground">
        Studio photography forthcoming for {productName}.
      </div>
    );
  }

  const activeImage = images[selectedIndex] ?? images[0];
  if (!activeImage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-md border border-border bg-muted/40">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {images.map((image, idx) => (
              <div key={image.id} className="relative aspect-[4/5] min-w-0 flex-[0_0_100%]">
                <Image
                  src={image.url}
                  alt={image.altText}
                  fill
                  preload={idx === 0}
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Open high-resolution image viewer"
          className="absolute right-3 bottom-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-accent hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Expand className="size-4" aria-hidden="true" />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Previous image"
              className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card/85 text-foreground backdrop-blur-sm transition-colors hover:border-accent hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Next image"
              className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card/85 text-foreground backdrop-blur-sm transition-colors hover:border-accent hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-medium text-foreground tabular-nums-price backdrop-blur-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          {images.map((image, idx) => {
            const active = idx === selectedIndex;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => selectSlide(idx)}
                aria-label={`View image ${idx + 1}: ${image.altText}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative aspect-square cursor-pointer overflow-hidden rounded-sm border bg-muted transition-all focus-visible:outline-2 focus-visible:outline-ring",
                  active
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-border opacity-80 hover:opacity-100",
                )}
              >
                <Image
                  src={image.thumbUrl ?? image.mediumUrl ?? image.url}
                  alt=""
                  fill
                  sizes="110px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-4 sm:p-6">
          <DialogTitle className="font-display text-xl">{productName}</DialogTitle>
          <DialogDescription>{activeImage.altText}</DialogDescription>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-muted">
            <Image
              src={activeImage.url}
              alt={activeImage.altText}
              fill
              sizes="(max-width: 1024px) 95vw, 900px"
              className="object-contain"
            />
          </div>
          {images.length > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => selectSlide((selectedIndex - 1 + images.length) % images.length)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-4 text-sm hover:bg-muted"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span>Previous</span>
              </button>
              <span className="text-xs text-muted-foreground tabular-nums-price">
                {selectedIndex + 1} of {images.length}
              </span>
              <button
                type="button"
                onClick={() => selectSlide((selectedIndex + 1) % images.length)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-4 text-sm hover:bg-muted"
              >
                <span>Next</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
