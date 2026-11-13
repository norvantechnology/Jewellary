"use client";

import { extractApiErrorMessage } from "@/lib/api-error-message";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";

export const ACCEPTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface PreparedClientImage {
  file: File;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
  originalName: string;
  width?: number;
  height?: number;
}

function inferImageMime(file: File): string {
  if (file.type && ACCEPTED_IMAGE_MIMES.has(file.type.toLowerCase())) {
    return file.type.toLowerCase();
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return file.type || "application/octet-stream";
}

export async function prepareCustomerImageForUpload(file: File): Promise<PreparedClientImage> {
  const mime = inferImageMime(file);
  if (!ACCEPTED_IMAGE_MIMES.has(mime)) {
    throw new Error("Unsupported image format. Please choose JPG, PNG, WebP, or HEIC.");
  }

  // Raw files > 16 MB cannot be safely processed in browser memory
  if (file.size > 16 * 1024 * 1024) {
    throw new Error("Image file is too large (maximum 5 MB after optimization).");
  }

  // Client-side resize to <= 1600px, quality ~0.8 WebP (re-encoding on canvas strips EXIF metadata)
  try {
    const compressed = await resizeImageToWebP(file, 1600, 0.8);
    if (compressed.file.size > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
      const smaller = await resizeImageToWebP(file, 1280, 0.72);
      if (smaller.file.size > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
        throw new Error("Image still exceeds 5 MB after compression. Choose a smaller image.");
      }
      return {
        file: smaller.file,
        mimeType: "image/webp",
        sizeBytes: smaller.file.size,
        previewUrl: URL.createObjectURL(smaller.file),
        originalName: file.name,
        width: smaller.width,
        height: smaller.height,
      };
    }
    return {
      file: compressed.file,
      mimeType: "image/webp",
      sizeBytes: compressed.file.size,
      previewUrl: URL.createObjectURL(compressed.file),
      originalName: file.name,
      width: compressed.width,
      height: compressed.height,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("5 MB")) {
      throw err;
    }
    // Graceful fallback (e.g. browser without HEIC decode support) if original <= 5 MB
  }

  if (file.size > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image exceeds the 5 MB file size limit.");
  }

  return {
    file,
    mimeType: mime,
    sizeBytes: file.size,
    previewUrl: URL.createObjectURL(file),
    originalName: file.name,
  };
}

async function resizeImageToWebP(
  file: File,
  maxDimension: number,
  quality: number,
): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", quality),
    );
    if (!blob) {
      throw new Error("WebP encode failed");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
    return {
      file: new File([blob], `${baseName}.webp`, { type: "image/webp" }),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

interface UploadResultPayload {
  storageKey: string;
  thumbKey: string;
  url: string;
  thumbUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalName?: string;
  expiresAt: string;
  error?: unknown;
}

function postFormWithProgress(params: {
  url: string;
  formData: FormData;
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<UploadResultPayload> {
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(params.url, {
      method: "POST",
      body: params.formData,
      signal: params.signal,
    }).then(async (res) => {
      const json = (await res.json().catch(() => null)) as UploadResultPayload | null;
      if (!res.ok || !json?.storageKey) {
        throw new Error(extractApiErrorMessage(json, "Failed to verify and store image."));
      }
      return json;
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", params.url, true);

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    if (params.signal?.aborted) {
      abortHandler();
      return;
    }
    params.signal?.addEventListener("abort", abortHandler, { once: true });

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.min(95, Math.max(35, Math.round(35 + (evt.loaded / evt.total) * 60)));
        params.onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      params.signal?.removeEventListener("abort", abortHandler);
      try {
        const parsed = JSON.parse(xhr.responseText || "{}") as UploadResultPayload;
        if (xhr.status >= 200 && xhr.status < 300 && parsed.storageKey) {
          resolve(parsed);
        } else {
          reject(new Error(extractApiErrorMessage(parsed, "Failed to verify and store image.")));
        }
      } catch {
        reject(new Error("Failed to verify and store image."));
      }
    };

    xhr.onerror = () => {
      params.signal?.removeEventListener("abort", abortHandler);
      reject(new Error("Network error during upload."));
    };

    xhr.send(params.formData);
  });
}

export async function uploadPrivateCustomerImage(params: {
  file: File;
  endpointPrefix: "/api/customizations/uploads" | "/api/chat/uploads";
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<{
  storageKey: string;
  thumbKey: string;
  url: string;
  thumbUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalName?: string;
  expiresAt: string;
}> {
  params.onProgress?.(10);
  const prepared = await prepareCustomerImageForUpload(params.file);
  params.onProgress?.(25);

  try {
    if (params.signal?.aborted) {
      throw new DOMException("Upload cancelled", "AbortError");
    }

    const signRes = await fetch(`${params.endpointPrefix}/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        fileName: prepared.originalName,
        mimeType: prepared.mimeType,
        byteSize: prepared.sizeBytes,
      }),
    });
    const signJson = (await signRes.json().catch(() => null)) as {
      uploadUrl?: string;
      error?: unknown;
    } | null;
    if (!signRes.ok || !signJson?.uploadUrl) {
      throw new Error(extractApiErrorMessage(signJson, "Unable to initialize image upload."));
    }

    params.onProgress?.(35);
    const formData = new FormData();
    formData.append("file", prepared.file);

    const confirmJson = await postFormWithProgress({
      url: signJson.uploadUrl,
      formData,
      signal: params.signal,
      onProgress: params.onProgress,
    });

    params.onProgress?.(100);
    return {
      ...confirmJson,
      width: confirmJson.width ?? prepared.width,
      height: confirmJson.height ?? prepared.height,
    };
  } finally {
    URL.revokeObjectURL(prepared.previewUrl);
  }
}
