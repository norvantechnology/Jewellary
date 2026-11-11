/**
 * Validates post-auth redirect targets to block open-redirect attacks.
 * Only relative in-app paths starting with "/" (and never "//" or "/\\") are permitted.
 */
export function sanitizeRedirectPath(
  candidate: string | string[] | null | undefined,
  fallback = "/account",
): string {
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}
