import "server-only";
import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/server/logger";

export const REALTIME_CHANNEL = "maison-aurelia:realtime";

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      message: Record<string, unknown>;
      customerTargetKeys: string[];
      notifyAdminInbox: boolean;
    }
  | {
      type: "conversation.read";
      conversationId: string;
      readerRole: "CUSTOMER" | "ADMIN";
      lastReadSeq: number;
      readAt: string;
      customerTargetKeys: string[];
    }
  | {
      type: "conversation.updated";
      conversationId: string;
      status: string;
      assignedToId: string | null;
      tags: string[];
      lastMessageAt: string;
      lastMessagePreview: string | null;
      customerTargetKeys: string[];
      notifyAdminInbox: boolean;
    }
  | {
      type: "typing";
      conversationId: string;
      actorRole: "CUSTOMER" | "ADMIN";
      actorName: string;
      isTyping: boolean;
      customerTargetKeys: string[];
      notifyAdminInbox: boolean;
    }
  | {
      type: "customization.updated";
      requestId: string;
      status: string;
      customerTargetKeys: string[];
      notifyAdminInbox: boolean;
    };

interface BusState {
  emitter: EventEmitter;
  pub: Redis | null;
  sub: Redis | null;
  pubReady: boolean;
  subInitialized: boolean;
  redisInitAttempted: boolean;
}

const globalForRealtime = globalThis as unknown as {
  __atelierRealtimeBus?: BusState;
};

function getBusState(): BusState {
  if (!globalForRealtime.__atelierRealtimeBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalForRealtime.__atelierRealtimeBus = {
      emitter,
      pub: null,
      sub: null,
      pubReady: false,
      subInitialized: false,
      redisInitAttempted: false,
    };
  }
  return globalForRealtime.__atelierRealtimeBus;
}

function getRedisTarget(): string | { host: string; port: number } | null {
  if (process.env.VITEST === "true" && process.env.FORCE_REDIS_IN_TEST !== "true") {
    return null;
  }
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }
  if (env.REDIS_HOST) {
    return { host: env.REDIS_HOST, port: env.REDIS_PORT };
  }
  if (process.env.REDIS_PORT) {
    return { host: "127.0.0.1", port: env.REDIS_PORT };
  }
  return null;
}

function createRedisClient(target: string | { host: string; port: number }): Redis {
  const options = {
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 2500)),
  };
  return typeof target === "string"
    ? new Redis(target, options)
    : new Redis({ ...options, host: target.host, port: target.port });
}

async function ensureRedisPublisher(): Promise<Redis | null> {
  const state = getBusState();
  if (state.pub && state.pubReady) {
    return state.pub;
  }
  if (state.redisInitAttempted && !state.pub) {
    return null;
  }

  const target = getRedisTarget();
  if (!target) {
    return null;
  }

  state.redisInitAttempted = true;
  try {
    const client = state.pub ?? createRedisClient(target);
    if (!state.pub) {
      state.pub = client;
      client.on("ready", () => {
        state.pubReady = true;
      });
      client.on("close", () => {
        state.pubReady = false;
      });
      client.on("error", (err) => {
        state.pubReady = false;
        logger.debug({ err }, "Realtime Redis publisher unavailable; using fallback bus");
      });
    }
    if (client.status === "wait") {
      await client.connect();
      state.pubReady = true;
    }
    return state.pubReady ? client : null;
  } catch (err) {
    state.pubReady = false;
    logger.debug({ err }, "Failed to connect realtime Redis publisher");
    return null;
  }
}

async function ensureRedisSubscriber(): Promise<void> {
  const state = getBusState();
  if (state.subInitialized) return;
  const target = getRedisTarget();
  if (!target) return;

  state.subInitialized = true;
  try {
    const sub = createRedisClient(target);
    state.sub = sub;
    sub.on("error", (err) => {
      logger.debug({ err }, "Realtime Redis subscriber error");
    });
    sub.on("message", (channel, raw) => {
      if (channel !== REALTIME_CHANNEL) return;
      try {
        const parsed = JSON.parse(raw) as RealtimeEvent;
        state.emitter.emit("event", parsed);
      } catch {
        // Ignore malformed pub/sub frames
      }
    });
    await sub.connect();
    await sub.subscribe(REALTIME_CHANNEL);
  } catch (err) {
    logger.debug({ err }, "Realtime Redis subscriber disabled; local EventEmitter active");
  }
}

async function forwardToLoopbackGateway(serialized: string): Promise<void> {
  const gatewayUrl = process.env.REALTIME_GATEWAY_URL;
  if (!gatewayUrl) return;

  try {
    const sig = createHmac("sha256", env.BETTER_AUTH_SECRET).update(serialized).digest("hex");
    await fetch(`${gatewayUrl.replace(/\/$/, "")}/__realtime/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-realtime-sig": sig,
      },
      body: serialized,
      signal: AbortSignal.timeout(1200),
    });
  } catch {
    // Non-fatal fallback; SSE/REST sync still holds source of truth in Postgres.
  }
}

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  const state = getBusState();
  // Always emit to in-process listeners (e.g. SSE routes in the same Next runtime)
  state.emitter.emit("event", event);

  const serialized = JSON.stringify(event);
  const redisPub = await ensureRedisPublisher();
  if (redisPub) {
    try {
      await redisPub.publish(REALTIME_CHANNEL, serialized);
      return;
    } catch {
      state.pubReady = false;
    }
  }

  await forwardToLoopbackGateway(serialized);
}

export function subscribeRealtimeEvents(handler: (event: RealtimeEvent) => void): () => void {
  const state = getBusState();
  state.emitter.on("event", handler);
  void ensureRedisSubscriber();

  return () => {
    state.emitter.off("event", handler);
  };
}

export async function closeRealtimeBus(): Promise<void> {
  const state = getBusState();
  const tasks: Array<Promise<unknown>> = [];
  if (state.pub) {
    tasks.push(state.pub.quit().catch(() => state.pub?.disconnect()));
    state.pub = null;
    state.pubReady = false;
  }
  if (state.sub) {
    tasks.push(state.sub.quit().catch(() => state.sub?.disconnect()));
    state.sub = null;
    state.subInitialized = false;
  }
  state.redisInitAttempted = false;
  await Promise.all(tasks);
}
