import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/dal";
import { AppError } from "@/server/errors";
import { deleteImagesIfUnused } from "@/server/image-cleanup";
import { enforceRateLimit } from "@/server/rate-limit";
import { storageKeyFromPublicUrl } from "@/server/storage";

/**
 * Removes images an admin uploaded but then replaced or removed before saving, so unsaved
 * uploads don't pile up in the bucket. Only fresh admin uploads (public/…) are accepted, and
 * a file is kept if any record already uses it.
 */
const discardSchema = z
  .object({ urls: z.array(z.string().trim().min(1).max(600)).min(1).max(50) })
  .strict();

export async function POST(request: Request) {
  try {
    const { user } = await requirePermission("catalog:write");
    await enforceRateLimit("uploadSign", user.id);

    const parsed = discardSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid discard request." } },
        { status: 400 },
      );
    }
    const urls = parsed.data.urls.filter((url) => {
      if (url.startsWith("/uploads/")) return true;
      return storageKeyFromPublicUrl(url)?.startsWith("public/") ?? false;
    });
    const removed = urls.length > 0 ? await deleteImagesIfUnused(urls) : 0;
    return NextResponse.json({ removed }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to discard images." } },
      { status: 500 },
    );
  }
}
