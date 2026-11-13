import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Determines whether cookies set during this request should carry the `Secure` attribute.
 * Checks incoming protocol/origin/host headers first so local or LAN HTTP sessions
 * persist guest cart, wishlist, and currency cookies even when NEXT_PUBLIC_SITE_URL
 * is configured with an HTTPS production domain.
 */
export async function isSecureRequestCookie(): Promise<boolean> {
  try {
    const hdrs = await headers();
    const forwardedProto = hdrs.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    if (forwardedProto === "https") return true;
    if (forwardedProto === "http") return false;

    const origin = hdrs.get("origin");
    if (origin?.startsWith("http://")) return false;
    if (origin?.startsWith("https://")) return true;

    const referer = hdrs.get("referer");
    if (referer?.startsWith("http://")) return false;
    if (referer?.startsWith("https://")) return true;

    const host = (hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "").toLowerCase();
    const hostname = host.split(":")[0] ?? "";
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
  } catch {
    // Outside an active request scope (e.g. unit tests)
  }

  return process.env.NODE_ENV === "production" && env.NEXT_PUBLIC_SITE_URL.startsWith("https://");
}
