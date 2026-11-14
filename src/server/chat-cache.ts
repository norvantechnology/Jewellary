import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/server/logger";

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

interface CacheState {
  redis: Redis | null;
  redisReady: boolean;
  redisRetryAfter: number;
  memory: Map<string, MemoryCacheEntry>;
  timings: Map<string, number[]>;
}

const MAX_MEMORY_ENTRIES = 500;
const MAX_TIMING_SAMPLES = 120;
const SLOW_QUERY_THRESHOLD_MS = 100;
const REDIS_RETRY_COOLDOWN_MS = 60_000;

const globalForChatCache = globalThis as unknown as {
  __atelierChatCacheState?: CacheState;
};

function getState(): CacheState {
  if (!globalForChatCache.__atelierChatCacheState) {
    globalForChatCache.__atelierChatCacheState = {
      redis: null,
      redisReady: false,
      redisRetryAfter: 0,
      memory: new Map(),
      timings: new Map(),
    };
  }
  return globalForChatCache.__atelierChatCacheState;
}

function getRedisTarget(): string | { host: string; port: number } | null {
  if (env.REDIS_URL) return env.REDIS_URL;
  if (env.REDIS_HOST) return { host: env.REDIS_HOST, port: env.REDIS_PORT };
  if (process.env.REDIS_PORT) return { host: "127.0.0.1", port: Number(process.env.REDIS_PORT) };
  return null;
}

async function ensureRedis(): Promise<Redis | null> {
  const state = getState();
  if (state.redisReady && state.redis) return state.redis;
  if (Date.now() < state.redisRetryAfter) return null;

  const target = getRedisTarget();
  if (!target) {
    state.redisRetryAfter = Date.now() + REDIS_RETRY_COOLDOWN_MS;
    return null;
  }

  try {
    const opts = {
      lazyConnect: true,
      enableReadyCheck: false,
      connectTimeout: 400,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    };
    const client =
      typeof target === "string"
        ? new Redis(target, opts)
        : new Redis({ host: target.host, port: target.port, ...opts });
    client.on("error", () => {
      state.redisReady = false;
    });
    await client.connect();
    state.redis = client;
    state.redisReady = true;
    return client;
  } catch {
    state.redisReady = false;
    state.redis = null;
    state.redisRetryAfter = Date.now() + REDIS_RETRY_COOLDOWN_MS;
    return null;
  }
}

export async function getSharedRedisClient(): Promise<Redis | null> {
  return ensureRedis();
}

function pruneMemoryCache(state: CacheState) {
  const now = Date.now();
  for (const [k, entry] of state.memory.entries()) {
    if (entry.expiresAt <= now) {
      state.memory.delete(k);
    }
  }
  if (state.memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = state.memory.keys().next().value;
    if (oldest) state.memory.delete(oldest);
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const state = getState();
  const mem = state.memory.get(key);
  if (mem) {
    if (mem.expiresAt > Date.now()) {
      try {
        return JSON.parse(mem.value) as T;
      } catch {
        state.memory.delete(key);
      }
    } else {
      state.memory.delete(key);
    }
  }

  const redis = await ensureRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    // Populate brief L1 in-memory cache (15s) to absorb repeated hits within instance
    if (state.memory.size >= MAX_MEMORY_ENTRIES) {
      pruneMemoryCache(state);
    }
    state.memory.set(key, { value: raw, expiresAt: Date.now() + 15_000 });
    return parsed;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const state = getState();
  const serialized = JSON.stringify(value);
  if (state.memory.size >= MAX_MEMORY_ENTRIES) {
    pruneMemoryCache(state);
  }
  state.memory.set(key, {
    value: serialized,
    expiresAt: Date.now() + Math.min(ttlSeconds, 300) * 1000,
  });

  const redis = await ensureRedis();
  if (!redis) return;
  try {
    await redis.set(key, serialized, "EX", Math.max(5, Math.round(ttlSeconds)));
  } catch {
    // non-fatal
  }
}

export async function cacheDeleteKey(key: string): Promise<void> {
  const state = getState();
  state.memory.delete(key);
  const redis = await ensureRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // non-fatal
  }
}

export function recordChatMetric(
  op: string,
  durationMs: number,
  meta?: Record<string, unknown>,
): void {
  const state = getState();
  const rounded = Math.round(durationMs * 100) / 100;
  let arr = state.timings.get(op);
  if (!arr) {
    arr = [];
    state.timings.set(op, arr);
  }
  arr.push(rounded);
  if (arr.length > MAX_TIMING_SAMPLES) {
    arr.shift();
  }
  if (rounded >= SLOW_QUERY_THRESHOLD_MS) {
    logger.warn({ op, durationMs: rounded, ...meta }, "Slow chat operation detected");
  }
}

export async function measureChatOp<T>(
  op: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    recordChatMetric(op, performance.now() - t0, meta);
  }
}

export function getChatPerfSnapshot(): Record<
  string,
  { count: number; p50Ms: number; p95Ms: number; maxMs: number }
> {
  const state = getState();
  const summary: Record<string, { count: number; p50Ms: number; p95Ms: number; maxMs: number }> =
    {};
  for (const [op, samples] of state.timings.entries()) {
    if (samples.length === 0) continue;
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5))]!;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
    summary[op] = {
      count: samples.length,
      p50Ms: p50,
      p95Ms: p95,
      maxMs: sorted[sorted.length - 1]!,
    };
  }
  return summary;
}
