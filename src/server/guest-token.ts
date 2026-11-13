import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { GUEST_COOKIE_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import { isSecureRequestCookie } from "@/server/request-protocol";

const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function signTokenValue(tokenId: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`guest:${tokenId}`)
    .digest("base64url");
}

export function buildSignedGuestCookieValue(tokenId: string): string {
  return `${tokenId}.${signTokenValue(tokenId)}`;
}

export function verifySignedGuestCookieValue(rawCookie: string | undefined | null): string | null {
  if (!rawCookie) return null;
  const dotIndex = rawCookie.indexOf(".");
  if (dotIndex <= 0) return null;

  const tokenId = rawCookie.slice(0, dotIndex);
  const providedSig = rawCookie.slice(dotIndex + 1);
  if (!/^[a-f0-9]{32}$/i.test(tokenId) || !providedSig) {
    return null;
  }

  const expectedSig = signTokenValue(tokenId);
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) return null;

  return timingSafeEqual(a, b) ? tokenId : null;
}

export async function readGuestTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return verifySignedGuestCookieValue(store.get(GUEST_COOKIE_NAME)?.value);
}

export async function getOrCreateGuestTokenCookie(): Promise<string> {
  const existing = await readGuestTokenFromCookies();
  if (existing) return existing;

  const tokenId = randomBytes(16).toString("hex");
  const signed = buildSignedGuestCookieValue(tokenId);
  const [store, secureCookie] = await Promise.all([cookies(), isSecureRequestCookie()]);

  store.set(GUEST_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });

  return tokenId;
}

export async function clearGuestTokenCookie(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE_NAME);
}
