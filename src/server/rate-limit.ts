import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { getSharedRedisClient } from "@/server/chat-cache";
import { RateLimitError } from "@/server/errors";
import { logger } from "@/server/logger";

export type RateLimitTier =
  | "auth"
  | "register"
  | "forgotPassword"
  | "authAccount"
  | "verificationEmail"
  | "emailRecipient"
  | "twoFactor"
  | "passwordUpdate"
  | "guestOrderLookup"
  | "checkout"
  | "enquiry"
  | "searchSuggest"
  | "newsletter"
  | "accountExport"
  | "uploadSign"
  | "adminWrite"
  | "publicCurrency"
  | "customizationSubmit"
  | "customizationGuestVerify"
  | "chatMessage"
  | "chatUpload"
  | "notFoundBeacon";

interface TierRule {
  limit: number;
  windowMs: number;
  upstashWindow: Parameters<typeof Ratelimit.slidingWindow>[1];
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, TierRule> = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  register: { limit: 3, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  forgotPassword: { limit: 3, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  // Per-account ceiling across all IPs (defeats distributed password guessing).
  authAccount: { limit: 20, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  verificationEmail: { limit: 3, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  // Per-recipient ceiling on any auth email, regardless of which IP asks for it.
  emailRecipient: { limit: 5, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  twoFactor: { limit: 5, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  passwordUpdate: { limit: 10, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  guestOrderLookup: { limit: 10, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  checkout: { limit: 20, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  enquiry: { limit: 5, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  searchSuggest: { limit: 60, windowMs: 60 * 1000, upstashWindow: "1 m" },
  newsletter: { limit: 5, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  accountExport: { limit: 5, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  uploadSign: { limit: 30, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  adminWrite: { limit: 120, windowMs: 60 * 1000, upstashWindow: "1 m" },
  publicCurrency: { limit: 120, windowMs: 60 * 1000, upstashWindow: "1 m" },
  customizationSubmit: { limit: 5, windowMs: 60 * 60 * 1000, upstashWindow: "1 h" },
  customizationGuestVerify: { limit: 5, windowMs: 15 * 60 * 1000, upstashWindow: "15 m" },
  chatMessage: { limit: 30, windowMs: 60 * 1000, upstashWindow: "1 m" },
  chatUpload: { limit: 60, windowMs: 10 * 60 * 1000, upstashWindow: "10 m" },
  notFoundBeacon: { limit: 30, windowMs: 60 * 1000, upstashWindow: "1 m" },
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const memoryBuckets = new Map<string, number[]>();
const MAX_MEMORY_BUCKETS = 5000;

export function clearMemoryRateLimits() {
  memoryBuckets.clear();
}

function pruneMemoryBuckets(now: number, maxWindowMs: number) {
  const cutoff = now - maxWindowMs;
  for (const [k, list] of memoryBuckets.entries()) {
    const latest = list[list.length - 1] ?? 0;
    if (latest <= cutoff) {
      memoryBuckets.delete(k);
    }
  }
  if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = memoryBuckets.keys().next().value;
    if (oldestKey) memoryBuckets.delete(oldestKey);
  }
}

function checkMemoryRateLimit(key: string, rule: TierRule): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const existing = memoryBuckets.get(key);
  const timestamps = existing ? existing.filter((ts) => ts > windowStart) : [];

  if (timestamps.length >= rule.limit) {
    const oldest = timestamps[0] ?? now;
    memoryBuckets.set(key, timestamps);
    return {
      success: false,
      limit: rule.limit,
      remaining: 0,
      reset: oldest + rule.windowMs,
    };
  }

  timestamps.push(now);
  if (!existing && memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    pruneMemoryBuckets(now, 60 * 60 * 1000);
  }
  memoryBuckets.set(key, timestamps);
  return {
    success: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - timestamps.length),
    reset: now + rule.windowMs,
  };
}

const REDIS_SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestScore = tonumber(oldest[2]) or now
  return {0, 0, oldestScore + window}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, now + window}
`;

let localRateLimitSeq = 0;

async function checkDirectRedisRateLimit(
  tier: RateLimitTier,
  identifier: string,
  rule: TierRule,
): Promise<RateLimitResult | null> {
  if (env.NODE_ENV === "test") return null;
  const redis = await getSharedRedisClient();
  if (!redis) return null;

  try {
    const now = Date.now();
    localRateLimitSeq = (localRateLimitSeq + 1) & 0x7fffffff;
    const member = `${now}:${localRateLimitSeq}:${Math.random().toString(36).slice(2, 7)}`;
    const res = (await redis.eval(
      REDIS_SLIDING_WINDOW_LUA,
      1,
      `rl:${tier}:${identifier}`,
      String(now),
      String(rule.windowMs),
      String(rule.limit),
      member,
    )) as [number, number, number];

    return {
      success: Number(res[0]) === 1,
      limit: rule.limit,
      remaining: Math.max(0, Number(res[1] ?? 0)),
      reset: Number(res[2] ?? now + rule.windowMs),
    };
  } catch {
    return null;
  }
}

let cachedRedis: Redis | null | undefined;
let upstashCooldownUntil = 0;
const upstashLimiters = new Map<RateLimitTier, Ratelimit>();

function isLocalhostUpstash(): boolean {
  return Boolean(
    env.UPSTASH_REDIS_REST_URL &&
    (env.UPSTASH_REDIS_REST_URL.includes("localhost") ||
      env.UPSTASH_REDIS_REST_URL.includes("127.0.0.1")),
  );
}

function getUpstashLimiter(tier: RateLimitTier): Ratelimit | null {
  if (env.NODE_ENV === "test") return null;
  if (Date.now() < upstashCooldownUntil) return null;
  if (cachedRedis === undefined) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      cachedRedis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        retry: { retries: 0 },
        signal: () => AbortSignal.timeout(400),
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

  // Prefer fast local ioredis when direct Redis is configured & Upstash isn't remote
  if (env.NODE_ENV !== "test" && (!env.UPSTASH_REDIS_REST_URL || isLocalhostUpstash())) {
    const redisResult = await checkDirectRedisRateLimit(tier, identifier, rule);
    if (redisResult) {
      return redisResult;
    }
  }

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
      const cooldownMs = isLocalhostUpstash() ? 5 * 60_000 : 60_000;
      upstashCooldownUntil = Date.now() + cooldownMs;
      logger.warn(
        { tier, err: error instanceof Error ? error.message : "unknown" },
        "Upstash Redis rate limit unavailable; falling back to Redis/memory bucket",
      );
    }
  }

  const redisFallback = await checkDirectRedisRateLimit(tier, identifier, rule);
  if (redisFallback) {
    return redisFallback;
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
