import { env } from "@/lib/env";
import { getSiteUrl, isNoindexRoutePath, toAbsoluteUrl } from "@/lib/seo/site";
import { getConfiguredSeoIndexNowKey } from "@/modules/settings/settings.service";

const recentSubmittedAt = new Map<string, number>();
const MIN_RESUBMIT_INTERVAL_MS = 1000 * 60 * 5; // 5-minute cooldown per URL

export async function getConfiguredIndexNowKey(): Promise<string | null> {
  try {
    const fromDb = await getConfiguredSeoIndexNowKey();
    if (fromDb) return fromDb;
  } catch {
    // Fallback cleanly to env during early boot/tests
  }
  return env.INDEXNOW_KEY ?? null;
}

export interface IndexNowSubmitResult {
  submitted: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Submits changed canonical URLs to IndexNow endpoints with deduplication and rate limiting.
 * Never throws in caller admin mutations if external network is unavailable.
 */
export async function submitIndexNowUrls(pathsOrUrls: string[]): Promise<IndexNowSubmitResult> {
  const key = await getConfiguredIndexNowKey();
  if (!key) {
    return { submitted: 0, skipped: true, reason: "IndexNow key not configured." };
  }

  const origin = getSiteUrl();
  const host = new URL(origin).host;
  const now = Date.now();

  const eligibleUrls = Array.from(
    new Set(
      pathsOrUrls
        .map((item) => toAbsoluteUrl(item))
        .filter((absUrl) => {
          try {
            const parsed = new URL(absUrl);
            if (parsed.host !== host) return false;
            if (isNoindexRoutePath(parsed.pathname)) return false;
            const lastSent = recentSubmittedAt.get(absUrl);
            if (lastSent && now - lastSent < MIN_RESUBMIT_INTERVAL_MS) return false;
            return true;
          } catch {
            return false;
          }
        }),
    ),
  ).slice(0, 1000);

  if (eligibleUrls.length === 0) {
    return { submitted: 0, skipped: true, reason: "No eligible changed URLs outside cooldown." };
  }

  for (const url of eligibleUrls) {
    recentSubmittedAt.set(url, now);
  }

  if (env.NODE_ENV === "test") {
    return {
      submitted: eligibleUrls.length,
      skipped: true,
      reason: "Skipped external ping in test env.",
    };
  }

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${origin}/${key}.txt`,
        urlList: eligibleUrls,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {
        submitted: 0,
        skipped: false,
        reason: `IndexNow responded with HTTP ${res.status}`,
      };
    }
    return { submitted: eligibleUrls.length, skipped: false };
  } catch (err) {
    return {
      submitted: 0,
      skipped: false,
      reason: err instanceof Error ? err.message : "IndexNow request failed",
    };
  }
}
