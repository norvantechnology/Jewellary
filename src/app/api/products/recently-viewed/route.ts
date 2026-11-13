import { NextResponse } from "next/server";
import { listPublicProductsByIds } from "@/modules/catalog/catalog.public";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawIds = url.searchParams.get("ids") ?? "";
  const exclude = url.searchParams.get("exclude")?.trim() ?? "";

  const ids = rawIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id !== exclude)
    .slice(0, 12);

  const items = await listPublicProductsByIds(ids);

  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    },
  );
}
