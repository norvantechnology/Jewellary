import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { RateLimitError } from "@/server/errors";
import { enforceRateLimit, getClientIp, type RateLimitTier } from "@/server/rate-limit";

const authHandler = toNextJsHandler(auth);

function resolveRateLimitTier(pathname: string): RateLimitTier | null {
  if (pathname.endsWith("/sign-in/email")) return "auth";
  if (pathname.endsWith("/sign-up/email")) return "register";
  if (pathname.endsWith("/request-password-reset")) return "forgotPassword";
  return null;
}

export async function GET(request: Request) {
  return authHandler.GET(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const tier = resolveRateLimitTier(url.pathname);
  let forwardedRequest = request;

  if (tier) {
    try {
      const ip = await getClientIp();
      let rateKey = ip;

      if (tier === "auth") {
        const rawBody = await request.text();
        try {
          const body = JSON.parse(rawBody) as { email?: unknown };
          const normalizedEmail =
            typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          if (normalizedEmail) {
            rateKey = `${ip}:${normalizedEmail}`;
          }
        } catch {
          // Ignore malformed JSON here; Better Auth returns standard 400
        }
        const headersCopy = new Headers(request.headers);
        headersCopy.delete("content-length");
        forwardedRequest = new Request(request.url, {
          method: request.method,
          headers: headersCopy,
          body: rawBody,
        });
      }

      await enforceRateLimit(tier, rateKey);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
            },
          },
          {
            status: 429,
            headers: error.retryAfterSeconds
              ? { "Retry-After": String(error.retryAfterSeconds) }
              : undefined,
          },
        );
      }
      throw error;
    }
  }

  return authHandler.POST(forwardedRequest);
}
