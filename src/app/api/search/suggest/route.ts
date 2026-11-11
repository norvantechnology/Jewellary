import { NextResponse } from "next/server";
import { z } from "zod";
import { getSearchSuggestions } from "@/modules/search/search.service";
import { RateLimitError } from "@/server/errors";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(request: Request) {
  try {
    const ip = await getClientIp();
    await enforceRateLimit("searchSuggest", ip);

    const { searchParams } = new URL(request.url);
    const parsed = suggestQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search query." }, { status: 400 });
    }

    const result = await getSearchSuggestions(parsed.data.q, parsed.data.limit);
    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Unable to load search suggestions." }, { status: 500 });
  }
}
