import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Server as SocketIOServer } from "socket.io";

export const REALTIME_CHANNEL = "shinora-jewels:realtime";

function extractJsonError(json, fallback) {
  if (!json || typeof json !== "object") return fallback;
  if (typeof json.error === "string" && json.error) return json.error;
  if (json.error && typeof json.error === "object" && typeof json.error.message === "string") {
    return json.error.message;
  }
  return fallback;
}

export function loadEnvFileIfNeeded(cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env");
  if (!existsSync(envPath)) return;
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // Ignore unreadable .env
  }
}

function getRedisTarget() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
  }
  if (process.env.REDIS_PORT) {
    return {
      host: "127.0.0.1",
      port: Number(process.env.REDIS_PORT),
    };
  }
  return null;
}

function buildRedisClient(target) {
  const options = {
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 2500)),
  };
  return typeof target === "string"
    ? new Redis(target, options)
    : new Redis({ ...options, host: target.host, port: target.port });
}

function isLoopbackAddress(addr) {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function verifyInternalSignature(rawBody, providedSig, secret) {
  if (!secret || !providedSig || typeof providedSig !== "string") return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readRequestBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function collectTargetRooms(event) {
  const rooms = new Set();
  if (event.conversationId) {
    rooms.add(`conv:${event.conversationId}`);
  }
  if (Array.isArray(event.customerTargetKeys)) {
    for (const key of event.customerTargetKeys) {
      if (typeof key === "string" && key.length > 0) {
        rooms.add(key);
      }
    }
  }
  if (event.notifyAdminInbox) {
    rooms.add("admin:inbox");
  }
  return Array.from(rooms);
}

export function broadcastRealtimeEvent(io, event) {
  if (!event || typeof event !== "object") return;
  const rooms = collectTargetRooms(event);

  switch (event.type) {
    case "message.created":
      if (rooms.length > 0) {
        io.to(rooms).emit("chat:message", event);
      }
      break;
    case "conversation.read":
      if (rooms.length > 0) {
        io.to(rooms).emit("chat:read", event);
      }
      break;
    case "conversation.updated":
      if (rooms.length > 0) {
        io.to(rooms).emit("chat:conversation", event);
      }
      break;
    case "typing":
      if (rooms.length > 0) {
        io.to(rooms).emit("chat:typing", event);
      }
      break;
    case "customization.updated":
      if (rooms.length > 0) {
        io.to(rooms).emit("customization:updated", event);
      }
      break;
    default:
      break;
  }
}

async function fetchFromNext(nextPort, pathWithQuery, options = {}) {
  const url = `http://127.0.0.1:${nextPort}${pathWithQuery}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.forwardedFor ? { "x-forwarded-for": options.forwardedFor } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(options.host ? { host: options.host } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function forwardHttpToNext(req, res, nextPort, attempt = 0) {
  const upstreamHeaders = { ...req.headers };
  if (req.socket.remoteAddress && !upstreamHeaders["x-forwarded-for"]) {
    upstreamHeaders["x-forwarded-for"] = req.socket.remoteAddress;
  }
  upstreamHeaders["x-forwarded-proto"] =
    upstreamHeaders["x-forwarded-proto"] ?? (req.socket.encrypted ? "https" : "http");

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: nextPort,
      path: req.url,
      method: req.method,
      headers: upstreamHeaders,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    if (
      (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") &&
      attempt < 10 &&
      req.method === "GET"
    ) {
      setTimeout(() => forwardHttpToNext(req, res, nextPort, attempt + 1), 250);
      return;
    }
    if (!res.headersSent) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Upstream storefront server warming up" }));
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  res.on("close", () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });

  req.pipe(proxyReq);
}

function forwardUpgradeToNext(req, clientSocket, head, nextPort) {
  const upstreamSocket = net.connect(nextPort, "127.0.0.1", () => {
    const headerLines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstreamSocket.write(`${headerLines.join("\r\n")}\r\n\r\n`);
    if (head && head.length > 0) {
      upstreamSocket.write(head);
    }
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });

  upstreamSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstreamSocket.destroy());
}

export async function waitForNextHealth(nextPort, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${nextPort}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.status < 500) {
        return true;
      }
    } catch {
      // Still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

export async function createGatewayServer({ nextPort, authSecret, siteUrl }) {
  const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
  if (siteUrl) {
    try {
      allowedOrigins.add(new URL(siteUrl).origin);
    } catch {
      // ignore invalid siteUrl
    }
  }
  if (process.env.PORT) {
    allowedOrigins.add(`http://localhost:${process.env.PORT}`);
    allowedOrigins.add(`http://127.0.0.1:${process.env.PORT}`);
  }

  const httpServer = http.createServer(async (req, res) => {
    if (req.url?.startsWith("/socket.io")) {
      return;
    }

    if (req.url === "/__realtime/publish" && req.method === "POST") {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
        return;
      }
      try {
        const raw = await readRequestBody(req);
        const sig = req.headers["x-realtime-sig"];
        if (!verifyInternalSignature(raw, sig, authSecret)) {
          res.writeHead(403, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        const parsed = JSON.parse(raw);
        broadcastRealtimeEvent(io, parsed);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
      }
      return;
    }

    forwardHttpToNext(req, res, nextPort);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    serveClient: false,
    destroyUpgrade: false,
    pingInterval: 25000,
    pingTimeout: 20000,
    perMessageDeflate: false,
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        // Reject unknown cross-origin WebSocket connections cleanly
        callback(null, false);
      },
      credentials: true,
    },
  });

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) {
      return;
    }
    forwardUpgradeToNext(req, socket, head, nextPort);
  });

  const redisClients = [];
  const redisTarget = getRedisTarget();
  if (redisTarget) {
    try {
      const pubClient = buildRedisClient(redisTarget);
      const subClient = buildRedisClient(redisTarget);
      const busSubClient = buildRedisClient(redisTarget);
      for (const client of [pubClient, subClient, busSubClient]) {
        client.on("error", () => {
          // Non-fatal; gateway keeps serving single-instance Socket.IO
        });
      }
      await Promise.all([pubClient.connect(), subClient.connect(), busSubClient.connect()]);
      redisClients.push(pubClient, subClient, busSubClient);
      io.adapter(createAdapter(pubClient, subClient));
      await busSubClient.subscribe(REALTIME_CHANNEL);
      busSubClient.on("message", (channel, raw) => {
        if (channel !== REALTIME_CHANNEL) return;
        try {
          broadcastRealtimeEvent(io, JSON.parse(raw));
        } catch {
          // ignore malformed messages
        }
      });
    } catch {
      for (const client of redisClients) {
        client.disconnect();
      }
      redisClients.length = 0;
    }
  }

  // Bounded in-memory caches (30s TTL) backed by Redis when available
  const authCache = new Map();
  const membershipCache = new Map();

  function hashCookieKey(cookie) {
    return createHash("sha256")
      .update(cookie || "anon")
      .digest("hex")
      .slice(0, 24);
  }

  function getCachedEntry(map, key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      map.delete(key);
      return null;
    }
    return entry.value;
  }

  function setCachedEntry(map, key, value, ttlMs = 30000) {
    if (map.size >= 1000) {
      const oldest = map.keys().next().value;
      if (oldest) map.delete(oldest);
    }
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? "";
      const forwardedFor =
        socket.handshake.headers["x-forwarded-for"] ?? socket.handshake.address ?? "";
      const host = socket.handshake.headers.host ?? "";
      const authCacheKey = hashCookieKey(cookie);
      const cachedAuth = cookie ? getCachedEntry(authCache, authCacheKey) : null;
      if (cachedAuth) {
        socket.data.auth = cachedAuth;
        socket.data.authCacheKey = authCacheKey;
        next();
        return;
      }

      const result = await fetchFromNext(nextPort, "/api/chat/session", {
        cookie,
        forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor),
        host,
      });
      if (result.ok && result.json?.data) {
        socket.data.auth = result.json.data;
        if (cookie) {
          setCachedEntry(authCache, authCacheKey, result.json.data, 30000);
        }
      } else {
        socket.data.auth = {
          authenticated: false,
          userId: null,
          userName: "Guest",
          role: null,
          isStaff: false,
          guestToken: null,
          targetKeys: [],
        };
      }
      socket.data.authCacheKey = authCacheKey;
      next();
    } catch {
      socket.data.auth = {
        authenticated: false,
        userId: null,
        userName: "Guest",
        role: null,
        isStaff: false,
        guestToken: null,
        targetKeys: [],
      };
      next();
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth ?? {};
    const targetKeys = Array.isArray(auth.targetKeys) ? auth.targetKeys : [];
    for (const key of targetKeys) {
      socket.join(key);
    }
    if (auth.isStaff) {
      socket.join("admin:inbox");
    }

    const typingTimestamps = new Map();
    const rateWindowCounters = new Map();

    function allowSocketAction(actionKey, maxPerWindow, windowMs = 10000) {
      const now = Date.now();
      const bucket = rateWindowCounters.get(actionKey);
      if (!bucket || bucket.resetAt <= now) {
        rateWindowCounters.set(actionKey, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= maxPerWindow) {
        return false;
      }
      bucket.count += 1;
      return true;
    }

    socket.on("join_conversation", async (payload, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      try {
        const conversationId = payload?.conversationId;
        if (typeof conversationId !== "string" || !conversationId) {
          respond({ ok: false, error: "Invalid conversation ID." });
          return;
        }
        const afterSeq =
          typeof payload?.afterSeq === "number" && Number.isFinite(payload.afterSeq)
            ? payload.afterSeq
            : undefined;
        const memberKey = `${socket.data.authCacheKey ?? "anon"}:${conversationId}`;

        if (afterSeq === undefined && getCachedEntry(membershipCache, memberKey)) {
          await socket.join(`conv:${conversationId}`);
          respond({ ok: true, data: null });
          return;
        }

        const query =
          afterSeq !== undefined
            ? `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?afterSeq=${afterSeq}&limit=50`
            : `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=1`;
        const result = await fetchFromNext(nextPort, query, {
          cookie: socket.handshake.headers.cookie ?? "",
          host: socket.handshake.headers.host ?? "",
        });
        if (!result.ok) {
          respond({
            ok: false,
            status: result.status,
            error: extractJsonError(result.json, "Unable to access conversation."),
          });
          return;
        }
        setCachedEntry(membershipCache, memberKey, true, 30000);
        await socket.join(`conv:${conversationId}`);
        respond({
          ok: true,
          data: afterSeq !== undefined ? (result.json?.data ?? null) : null,
        });
      } catch {
        respond({ ok: false, error: "Failed to join conversation." });
      }
    });

    socket.on("leave_conversation", (payload) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId === "string" && conversationId) {
        void socket.leave(`conv:${conversationId}`);
      }
    });

    socket.on("sync_since", async (payload, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      try {
        const conversationId = payload?.conversationId;
        if (typeof conversationId !== "string" || !conversationId) {
          respond({ ok: false, error: "Invalid conversation ID." });
          return;
        }
        const afterSeq = Number(payload?.afterSeq ?? 0);
        const result = await fetchFromNext(
          nextPort,
          `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?afterSeq=${Math.max(0, afterSeq)}&limit=100`,
          {
            cookie: socket.handshake.headers.cookie ?? "",
            host: socket.handshake.headers.host ?? "",
          },
        );
        if (!result.ok) {
          respond({
            ok: false,
            status: result.status,
            error: extractJsonError(result.json, "Sync failed."),
          });
          return;
        }
        await socket.join(`conv:${conversationId}`);
        respond({ ok: true, data: result.json?.data ?? null });
      } catch {
        respond({ ok: false, error: "Failed to sync messages." });
      }
    });

    socket.on("send_message", async (payload, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      try {
        if (!allowSocketAction("send_message", 25, 10000)) {
          respond({ ok: false, status: 429, error: "You are sending messages too quickly." });
          return;
        }
        const conversationId = payload?.conversationId;
        if (typeof conversationId !== "string" || !conversationId) {
          respond({ ok: false, error: "Invalid conversation ID." });
          return;
        }
        const forwardedFor =
          socket.handshake.headers["x-forwarded-for"] ?? socket.handshake.address ?? "";
        const result = await fetchFromNext(
          nextPort,
          `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            method: "POST",
            cookie: socket.handshake.headers.cookie ?? "",
            forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor),
            host: socket.handshake.headers.host ?? "",
            body: {
              type: payload?.type,
              body: payload?.body,
              attachments: payload?.attachments,
              refId: payload?.refId,
              clientTempId: payload?.clientTempId,
            },
          },
        );
        if (!result.ok) {
          respond({
            ok: false,
            status: result.status,
            error: extractJsonError(result.json, "Message rejected."),
          });
          return;
        }
        respond({ ok: true, data: result.json?.data ?? null });
      } catch {
        respond({ ok: false, error: "Failed to deliver message." });
      }
    });

    socket.on("mark_read", async (payload, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      try {
        if (!allowSocketAction("mark_read", 15, 10000)) {
          respond({ ok: true });
          return;
        }
        const conversationId = payload?.conversationId;
        if (typeof conversationId !== "string" || !conversationId) {
          respond({ ok: false, error: "Invalid conversation ID." });
          return;
        }
        const result = await fetchFromNext(
          nextPort,
          `/api/chat/conversations/${encodeURIComponent(conversationId)}/read`,
          {
            method: "POST",
            cookie: socket.handshake.headers.cookie ?? "",
            host: socket.handshake.headers.host ?? "",
            body: { lastReadSeq: payload?.lastReadSeq },
          },
        );
        respond(
          result.ok
            ? { ok: true, data: result.json?.data }
            : { ok: false, error: result.json?.error },
        );
      } catch {
        respond({ ok: false, error: "Failed to mark read." });
      }
    });

    socket.on("typing", (payload) => {
      const conversationId = payload?.conversationId;
      if (typeof conversationId !== "string" || !conversationId) return;
      if (!socket.rooms.has(`conv:${conversationId}`)) return;

      const now = Date.now();
      const last = typingTimestamps.get(conversationId) ?? 0;
      if (payload?.isTyping && now - last < 1800) return;
      typingTimestamps.set(conversationId, now);

      const event = {
        type: "typing",
        conversationId,
        actorRole: auth.isStaff ? "ADMIN" : "CUSTOMER",
        actorName: auth.isStaff
          ? (auth.userName ?? "Atelier Concierge")
          : (auth.userName ?? "Guest"),
        isTyping: Boolean(payload?.isTyping),
      };
      socket.to(`conv:${conversationId}`).emit("chat:typing", event);
      if (!auth.isStaff) {
        socket.to("admin:inbox").emit("chat:typing", event);
      }
    });
  });

  async function close() {
    io.close();
    for (const client of redisClients) {
      await client.quit().catch(() => client.disconnect());
    }
    await new Promise((resolve) => httpServer.close(() => resolve()));
  }

  return { httpServer, io, close };
}
