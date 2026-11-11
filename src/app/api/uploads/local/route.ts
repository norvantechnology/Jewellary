import { NextResponse } from "next/server";
import { requirePermission } from "@/server/dal";
import { AppError } from "@/server/errors";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  verifyLocalUploadToken,
  writeLocalTempObject,
} from "@/server/storage";

export async function PUT(request: Request) {
  try {
    await requirePermission("catalog:write");

    const url = new URL(request.url);
    const key = url.searchParams.get("key") ?? "";
    const exp = Number(url.searchParams.get("exp") ?? "0");
    const token = url.searchParams.get("token") ?? "";

    if (!key || !Number.isFinite(exp) || !token || !verifyLocalUploadToken(key, exp, token)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired local upload token." } },
        { status: 401 },
      );
    }

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Uploaded file exceeds 10 MB limit." } },
        { status: 400 },
      );
    }

    await writeLocalTempObject(key, buf);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Local upload failed." } },
      { status: 500 },
    );
  }
}
