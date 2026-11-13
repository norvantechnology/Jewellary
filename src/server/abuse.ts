import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GENERIC_ABUSE_ERROR =
  "We could not verify your submission right now. Please wait a moment and try again.";

function signTimestamp(tsMs: number): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`abuse-form-v1:${tsMs}`).digest("hex");
}

/**
 * Generates an HMAC-signed timestamp token used to verify human form dwell time
 * without trusting client clocks or spoofed timestamps.
 */
export function createAbuseFormToken(nowMs = Date.now()): string {
  return `${nowMs}.${signTimestamp(nowMs)}`;
}

/**
 * Validates the signed timestamp token and enforces minimum & maximum dwell window.
 */
export function verifyAbuseTimingToken(
  token: string | undefined | null,
  options?: { minElapsedMs?: number; maxAgeMs?: number; nowMs?: number },
): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return false;

  const tsMs = Number(parts[0]);
  const providedSig = parts[1];
  if (!Number.isFinite(tsMs) || tsMs <= 0 || !providedSig) return false;

  const expectedSig = signTimestamp(tsMs);
  const a = Buffer.from(expectedSig, "utf8");
  const b = Buffer.from(providedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return false;
  }

  const nowMs = options?.nowMs ?? Date.now();
  const minElapsedMs = options?.minElapsedMs ?? env.ABUSE_TIME_TRAP_MS ?? 1000;
  const maxAgeMs = options?.maxAgeMs ?? TOKEN_MAX_AGE_MS;
  const elapsed = nowMs - tsMs;

  if (elapsed < minElapsedMs || elapsed > maxAgeMs) {
    return false;
  }
  return true;
}

/**
 * Verifies a Cloudflare Turnstile response server-side when TURNSTILE_SECRET_KEY is configured.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return true;
  }
  if (!token || token.trim().length === 0) {
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", env.TURNSTILE_SECRET_KEY);
    body.set("response", token.trim());
    if (remoteIp && remoteIp !== "unknown") {
      body.set("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Turnstile siteverify returned non-OK status");
      return false;
    }

    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Turnstile verification failed",
    );
    return false;
  }
}

/**
 * Enforces honeypot, signed server time-trap, and optional Cloudflare Turnstile verification.
 * Always throws generic, non-diagnostic error messages on abuse check failures.
 */
export async function assertHumanSubmission(input: {
  website?: string | null;
  timingToken?: string | null;
  turnstileToken?: string | null;
  ip?: string;
}): Promise<void> {
  if (input.website && input.website.length > 0) {
    throw new ValidationError(GENERIC_ABUSE_ERROR);
  }

  if (!verifyAbuseTimingToken(input.timingToken)) {
    throw new ValidationError(GENERIC_ABUSE_ERROR);
  }

  const turnstileOk = await verifyTurnstileToken(input.turnstileToken, input.ip);
  if (!turnstileOk) {
    throw new ValidationError(GENERIC_ABUSE_ERROR);
  }
}
