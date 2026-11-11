import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/dal";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { createSignedImageUpload, MAX_IMAGE_UPLOAD_BYTES } from "@/server/storage";

const signUploadSchema = z
  .object({
    folder: z.enum(["products", "categories", "banners", "articles", "store"]),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive().max(MAX_IMAGE_UPLOAD_BYTES),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const { user } = await requirePermission("catalog:write");
    await enforceRateLimit("uploadSign", user.id);

    const json = await request.json();
    const parsed = signUploadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid upload metadata." } },
        { status: 400 },
      );
    }

    const signed = await createSignedImageUpload(parsed.data);
    return NextResponse.json(signed, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to initiate upload." } },
      { status: 500 },
    );
  }
}
