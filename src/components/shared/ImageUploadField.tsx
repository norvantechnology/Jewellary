"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface UploadedImageResult {
  storageKey: string;
  url: string;
  mediumUrl: string;
  thumbUrl: string;
  avifUrl?: string;
  jpegUrl?: string;
  responsiveVariants?: Record<string, unknown>;
  warnings?: string[];
  width: number;
  height: number;
}

interface ImageUploadFieldProps {
  id: string;
  folder: "products" | "categories" | "banners" | "articles" | "store";
  label?: string;
  seoContext?: {
    slug?: string;
    productName?: string;
    metal?: string;
    carat?: string;
    viewType?: string;
  };
  onUploaded: (asset: UploadedImageResult) => void;
  currentUrl?: string;
  onUrlChange?: (url: string) => void;
  className?: string;
}

export function ImageUploadField({
  id,
  folder,
  label = "Upload Image",
  seoContext,
  onUploaded,
  currentUrl,
  onUrlChange,
  className,
}: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
        }),
      });

      const signJson = (await signRes.json()) as {
        mode?: "s3" | "local";
        uploadUrl?: string;
        tempKey?: string;
        error?: { message: string };
      };

      if (!signRes.ok || !signJson.uploadUrl || !signJson.tempKey || !signJson.mode) {
        throw new Error(signJson.error?.message ?? "Could not obtain upload signature.");
      }

      const putRes = await fetch(signJson.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Image binary upload failed.");
      }

      const confirmRes = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempKey: signJson.tempKey,
          folder,
          mode: signJson.mode,
          ...(seoContext ? { seo: seoContext } : {}),
        }),
      });

      const confirmJson = (await confirmRes.json()) as UploadedImageResult & {
        error?: { message: string };
      };
      if (!confirmRes.ok || !confirmJson.url) {
        throw new Error(confirmJson.error?.message ?? "Image verification failed.");
      }

      onUploaded(confirmJson);
      if (confirmJson.warnings && confirmJson.warnings.length > 0) {
        toast.warning(confirmJson.warnings[0]);
      } else {
        toast.success("Image verified & optimized (AVIF + WebP + JPEG)");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileSelect}
          className="sr-only"
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {uploading ? "Processing..." : "Choose Image"}
        </Button>

        {onUrlChange && (
          <Input
            aria-label={`${label} URL`}
            value={currentUrl ?? ""}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="/images/... or CDN URL"
            className="w-full min-w-0 sm:w-auto sm:min-w-[14rem] sm:flex-1"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Accepted: JPEG, PNG, WebP, AVIF up to 10 MB. Re-encoded cleanly to WebP with EXIF stripped.
      </p>
    </div>
  );
}
