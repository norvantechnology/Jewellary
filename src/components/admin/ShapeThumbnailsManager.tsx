"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadImageFile } from "@/components/shared/ImageUploadField";
import { setLandingFacetImageAction } from "@/modules/seo/seo.actions";
import type { LandingFacetDTO } from "@/modules/seo/seo.service";

/**
 * Thumbnails for shape pages (e.g. Oval Engagement Rings) shown in "Shop by shape" on the home
 * page. Without one, the tile uses a photo of a matching product.
 */
export function ShapeThumbnailsManager({ facets }: { facets: LandingFacetDTO[] }) {
  const groups = React.useMemo(() => {
    const map = new Map<string, LandingFacetDTO[]>();
    for (const f of facets) {
      if (!f.filterParams.shape?.length) continue;
      const list = map.get(f.categoryPath) ?? [];
      list.push(f);
      map.set(f.categoryPath, list);
    }
    return [...map.entries()];
  }, [facets]);

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Shape thumbnails</CardTitle>
        <CardDescription>
          Images for the &ldquo;Shop by shape&rdquo; tiles on the home page. Square images work best
          (800 × 800 px). With no image, a matching product photo is used. Replacing or removing an
          image deletes the old file from storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map(([path, list]) => (
          <section key={path} className="space-y-3">
            <h3 className="font-mono text-xs text-muted-foreground">/collections/{path}</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {list.map((facet) => (
                <ShapeTile key={facet.id} facet={facet} />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function ShapeTile({ facet }: { facet: LandingFacetDTO }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState(facet.imageUrl);

  async function save(next: string | null) {
    const res = await setLandingFacetImageAction({ id: facet.id, imageUrl: next });
    if (!res.ok) throw new Error(res.error.message);
    setImageUrl(next);
    router.refresh();
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadImageFile(file, "categories", {
        slug: facet.facetSlug,
        productName: facet.name,
      });
      await save(asset.url);
      toast.success(`${facet.name}: thumbnail updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await save(null);
      toast.success(`${facet.name}: thumbnail removed, a product photo is used instead.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the image");
    } finally {
      setBusy(false);
    }
  }

  const shape = facet.filterParams.shape?.[0] ?? facet.name;

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${shape} thumbnail`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden="true" />
            Product photo
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        <p className="truncate text-sm font-medium" title={facet.name}>
          {shape}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFile}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label={`${imageUrl ? "Replace" : "Upload"} ${shape} thumbnail`}
          >
            {imageUrl ? (
              <RefreshCw className="size-4" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            {imageUrl ? "Replace" : "Upload"}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={handleRemove}
              aria-label={`Remove ${shape} thumbnail`}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
