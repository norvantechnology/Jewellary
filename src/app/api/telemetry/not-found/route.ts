import { z } from "zod";
import { recordNotFoundHit } from "@/modules/seo/seo.service";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";

const beaconSchema = z.object({
  path: z.string().trim().min(1).max(500).startsWith("/"),
  referrer: z.string().trim().max(500).nullish(),
});

/**
 * 404 telemetry beacon. Sent from the browser only when the not-found page is actually shown,
 * because Next renders the root not-found boundary on every request and server-side logging
 * there recorded every page view as a 404.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  try {
    await enforceRateLimit("notFoundBeacon", await getClientIp());
    const parsed = beaconSchema.safeParse(JSON.parse(await request.text()));
    if (parsed.success) {
      await recordNotFoundHit({
        path: parsed.data.path,
        referrer: parsed.data.referrer ?? null,
        userAgent: request.headers.get("user-agent"),
      });
    }
  } catch {
    // Telemetry is best effort; never surface errors to the visitor.
  }
  return new Response(null, { status: 204 });
}
