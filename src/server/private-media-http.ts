import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";
import { resolveActorIdentity } from "@/server/customer-identity";
import { AppError, ValidationError } from "@/server/errors";
import {
  createSignedCustomerImageUpload,
  processAndPersistCustomerImage,
  verifyCustomerUploadToken,
  type PrivateMediaFolder,
} from "@/server/private-media";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";

const signRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(3).max(80),
  byteSize: z.number().int().positive().max(MAX_CUSTOMER_IMAGE_UPLOAD_BYTES),
});

export function jsonApiError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          fieldErrors: err.fieldErrors,
        },
      },
      { status: err.statusCode },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}

export async function handlePrivateUploadSign(
  req: Request,
  folder: PrivateMediaFolder,
): Promise<Response> {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const ip = await getClientIp();
    await enforceRateLimit("chatUpload", `${actor.primaryOwnerKey}:${ip}`);

    const rawBody = await req.json().catch(() => null);
    const parsed = signRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Invalid upload request parameters.",
      );
    }

    const signed = createSignedCustomerImageUpload({
      folder,
      ownerKey: actor.primaryOwnerKey,
      mimeType: parsed.data.mimeType,
      byteSize: parsed.data.byteSize,
      fileName: parsed.data.fileName,
    });

    return NextResponse.json({
      uploadUrl: signed.uploadUrl,
      uploadToken: signed.uploadToken,
      storageKey: signed.storageKey,
      method: signed.method,
      expiresInSeconds: signed.expiresInSeconds,
      maxBytes: signed.maxBytes,
    });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function handlePrivateUploadConfirm(
  req: Request,
  expectedFolder: PrivateMediaFolder,
): Promise<Response> {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? req.headers.get("x-upload-token") ?? "";
    if (!token) {
      throw new ValidationError("Missing upload token.");
    }

    const tokenPayload = verifyCustomerUploadToken(token);
    if (!tokenPayload || tokenPayload.folder !== expectedFolder) {
      throw new ValidationError("Upload session expired or invalid. Please retry.");
    }

    if (!actor.allOwnerKeys.includes(tokenPayload.ownerKey)) {
      throw new ValidationError("Upload session does not belong to the active browser session.");
    }

    const ip = await getClientIp();
    await enforceRateLimit("chatUpload", `${actor.primaryOwnerKey}:${ip}`);

    let buffer: Buffer;
    let fileName = url.searchParams.get("fileName") ?? "attachment.webp";

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new ValidationError("Expected an image file in form field 'file'.");
      }
      if (file.size > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
        throw new ValidationError("Image exceeds the 5 MB file size limit.");
      }
      fileName = file.name || fileName;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const arrBuf = await req.arrayBuffer();
      if (arrBuf.byteLength > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
        throw new ValidationError("Image exceeds the 5 MB file size limit.");
      }
      buffer = Buffer.from(arrBuf);
    }

    const persisted = await processAndPersistCustomerImage({
      storageKey: tokenPayload.storageKey,
      ownerKey: tokenPayload.ownerKey,
      buffer,
    });

    return NextResponse.json({
      storageKey: persisted.storageKey,
      thumbKey: persisted.thumbKey,
      url: persisted.url,
      thumbUrl: persisted.thumbUrl,
      mimeType: persisted.mimeType,
      sizeBytes: persisted.sizeBytes,
      width: persisted.width,
      height: persisted.height,
      originalName: fileName.slice(0, 120),
      exifStripped: persisted.exifStripped,
      scanStatus: persisted.scanStatus,
      expiresAt: persisted.expiresAt,
    });
  } catch (err) {
    return jsonApiError(err);
  }
}
