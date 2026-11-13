import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { RateLimitError } from "@/server/errors";
import { enforceRateLimit, getClientIp, type RateLimitTier } from "@/server/rate-limit";

const authHandler = toNextJsHandler(auth);

interface RoutePolicy {
  /** Per-IP tier (keyed `ip` or `ip:email` when an email is present). */
  ipTier: RateLimitTier;
  /** Extra per-email tier applied across all IPs. */
  emailTier?: RateLimitTier;
  /** Whether the email-keyed bucket should combine with IP for the ipTier. */
  ipWithEmail?: boolean;
}

/** Every auth endpoint that verifies a secret or sends an email is limited. */
function resolvePolicy(pathname: string): RoutePolicy | null {
  if (pathname.endsWith("/sign-in/email"))
    return { ipTier: "auth", emailTier: "authAccount", ipWithEmail: true };
  if (pathname.endsWith("/sign-up/email"))
    return { ipTier: "register", emailTier: "emailRecipient" };
  if (pathname.endsWith("/request-password-reset") || pathname.endsWith("/forget-password"))
    return { ipTier: "forgotPassword", emailTier: "emailRecipient" };
  if (pathname.endsWith("/send-verification-email"))
    return { ipTier: "verificationEmail", emailTier: "emailRecipient" };
  if (pathname.endsWith("/reset-password") || pathname.endsWith("/change-password"))
    return { ipTier: "passwordUpdate" };
  if (pathname.includes("/two-factor/")) return { ipTier: "twoFactor" };
  return null;
}

function tooMany(error: RateLimitError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    {
      status: 429,
      headers: error.retryAfterSeconds
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined,
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/verify-email")) {
    try {
      await enforceRateLimit("passwordUpdate", `verify:${await getClientIp()}`);
    } catch (error) {
      if (error instanceof RateLimitError) return tooMany(error);
      throw error;
    }
  }
  return authHandler.GET(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const policy = resolvePolicy(url.pathname);
  if (!policy) return authHandler.POST(request);

  // Read the body once so we can key on the email, then forward an identical request.
  const rawBody = await request.text();
  let email = "";
  try {
    const body = JSON.parse(rawBody) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // Malformed JSON: Better Auth returns its standard 400.
  }

  try {
    const ip = await getClientIp();
    await enforceRateLimit(policy.ipTier, policy.ipWithEmail && email ? `${ip}:${email}` : ip);
    if (policy.emailTier && email) {
      await enforceRateLimit(policy.emailTier, email);
    }
  } catch (error) {
    if (error instanceof RateLimitError) return tooMany(error);
    throw error;
  }

  const headersCopy = new Headers(request.headers);
  headersCopy.delete("content-length");
  return authHandler.POST(
    new Request(request.url, { method: request.method, headers: headersCopy, body: rawBody }),
  );
}
