import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAbuseFormToken } from "@/server/abuse";

export function GET() {
  return NextResponse.json(
    {
      token: createAbuseFormToken(),
      turnstileSiteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
      },
    },
  );
}
