import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_FOLDERS = new Set(["products", "categories", "banners", "articles", "store"]);
const SAFE_FILENAME_PATTERN = /^[a-z0-9][a-z0-9_-]*\.webp$/i;
const UPLOAD_ROOT = path.resolve(process.cwd(), "public", "uploads");

/**
 * Dynamically serves runtime-uploaded local WebP images in standalone/server mode
 * where static `public/` indexes are snapshotted at server startup.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ folder: string; filename: string }> },
) {
  const { folder, filename } = await context.params;

  if (!ALLOWED_FOLDERS.has(folder) || !SAFE_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
  }

  const targetPath = path.resolve(UPLOAD_ROOT, folder, filename);
  if (!targetPath.startsWith(`${UPLOAD_ROOT}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
  }

  try {
    const buffer = await readFile(targetPath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}
