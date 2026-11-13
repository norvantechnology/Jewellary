import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/dal";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { processAndPersistImageUpload } from "@/server/storage";

const confirmUploadSchema = z
  .object({
    tempKey: z.string().min(1),
    folder: z.enum(["products", "categories", "banners", "articles", "store"]),
    mode: z.enum(["s3", "local"]),
    seo: z
      .object({
        slug: z.string().max(160).optional(),
        productName: z.string().max(160).optional(),
        metal: z.string().max(60).optional(),
        carat: z.string().max(24).optional(),
        viewType: z.string().max(30).optional(),
        copyrightNotice: z.string().max(200).optional(),
      })
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("catalog:write");
    await enforceRateLimit("uploadSign", actor.user.id);

    const json = await request.json();
    const parsed = confirmUploadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid upload confirmation payload." } },
        { status: 400 },
      );
    }

    const result = await processAndPersistImageUpload(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to verify uploaded image." } },
      { status: 500 },
    );
  }
}
