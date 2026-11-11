import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { RateLimitError } from "@/server/errors";
import { logger } from "@/server/logger";

export type RateLimitTier =
  | "auth"
  | "register"
  | "forgotPassword"
  | "guestOrderLookup"
  | "checkout"
  | "enquiry"
  | "searchSuggest"
  | "newsletter"
  | "uploadSign"
  | "adminWrite";

interface TierRule {
  limit: number;
  windowMs: number;
  upstashWindow: Parameters<typeof Ratelimit.slidingWindow>[1];
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, TierRule> = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  register: { limit: 3, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  forgotPassword: { limit: 3, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  guestOrderLookup: { limit: 10, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  checkout: { limit: 20, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  enquiry: { limit: 5, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  searchSuggest: { limit: 60, windowMs: 60 * 1000, upstashWindow: "1 m" },
  newsletter: { limit: 5, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  uploadSign: { limit: 30, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  adminWrite: { limit: 120, windowMs: 60 * 1000, upstashWindow: "1 m" },
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const memoryBuckets = new Map<string, number[]>();

export function clearMemoryRateLimits() {
  memoryBuckets.clear();
}

function checkMemoryRateLimit(key: string, rule: TierRule): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const timestamps = (memoryBuckets.get(key) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= rule.limit) {
    const oldest = timestamps[0] ?? now;
    return {
      success: false,
      limit: rule.limit,
      remaining: 0,
      reset: oldest + rule.windowMs,
    };
  }

  timestamps.push(now);
  memoryBuckets.set(key, timestamps);
  return {
    success: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - timestamps.length),
    reset: now + rule.windowMs,
  };
}

let cachedRedis: Redis | null | undefined;
const upstashLimiters = new Map<RateLimitTier, Ratelimit>();

function getUpstashLimiter(tier: RateLimitTier): Ratelimit | null {
  if (env.NODE_ENV === "test") return null;
  if (cachedRedis === undefined) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      cachedRedis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      cachedRedis = null;
    }
  }
  if (!cachedRedis) return null;

  let limiter = upstashLimiters.get(tier);
  if (!limiter) {
    const rule = RATE_LIMIT_TIERS[tier];
    limiter = new Ratelimit({
      redis: cachedRedis,
      limiter: Ratelimit.slidingWindow(rule.limit, rule.upstashWindow),
      prefix: `rl:${tier}`,
      analytics: false,
    });
    upstashLimiters.set(tier, limiter);
  }
  return limiter;
}

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) {
      return xff.split(",")[0]?.trim() || "127.0.0.1";
    }
    return h.get("x-real-ip")?.trim() || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

export async function getClientUserAgent(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("user-agent") ?? undefined;
  } catch {
    return undefined;
  }
}

export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMIT_TIERS[tier];
  const limiter = getUpstashLimiter(tier);

  if (limiter) {
    try {
      const res = await limiter.limit(identifier);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
      };
    } catch (error) {
      logger.warn(
        { tier, err: error instanceof Error ? error.message : "unknown" },
        "Upstash Redis rate limit unavailable; falling back to local memory bucket",
      );
    }
  }

  return checkMemoryRateLimit(`${tier}:${identifier}`, rule);
}

export async function enforceRateLimit(
  tier: RateLimitTier,
  identifier?: string,
): Promise<RateLimitResult> {
  const key = identifier ?? (await getClientIp());
  const result = await checkRateLimit(tier, key);
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    throw new RateLimitError(undefined, retryAfter);
  }
  return result;
}
