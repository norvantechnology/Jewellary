import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getConfiguredIndexNowKey } from "@/lib/seo/indexnow";

export async function GET(request: NextRequest) {
  const configuredKey = await getConfiguredIndexNowKey();
  if (!configuredKey) {
    return new NextResponse("Not found", { status: 404 });
  }

  const candidate = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  const a = Buffer.from(candidate);
  const b = Buffer.from(configuredKey);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(configuredKey, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
