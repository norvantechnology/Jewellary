"use client";

import * as React from "react";
import type { Socket } from "socket.io-client";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import type { ChatMessageDTO } from "@/modules/chat/chat.service";

interface RealtimeSocketState {
  socket: Socket | null;
  initPromise: Promise<Socket | null> | null;
  connected: boolean;
  failed: boolean;
  visibilityBound: boolean;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  pausedByHidden: boolean;
}

const state: RealtimeSocketState = {
  socket: null,
  initPromise: null,
  connected: false,
  failed: false,
  visibilityBound: false,
  hiddenTimer: null,
  pausedByHidden: false,
};

const statusListeners = new Set<(connected: boolean) => void>();
const failureListeners = new Set<(failed: boolean) => void>();

// Typing throttle (<= 1 per 2s) and debounced mark-read (500ms)
const typingLastSentAt = new Map<string, number>();
const readDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const readMaxSeqPending = new Map<string, number>();

function notifyStatus(connected: boolean) {
  state.connected = connected;
  if (connected) {
    state.failed = false;
    for (const fn of failureListeners) fn(false);
  }
  for (const fn of statusListeners) {
    fn(connected);
  }
}

function notifyFailure(failed: boolean) {
  state.failed = failed;
  for (const fn of failureListeners) {
    fn(failed);
  }
}

function bindVisibilityLifecycle() {
  if (typeof document === "undefined" || state.visibilityBound) return;
  state.visibilityBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (state.hiddenTimer) clearTimeout(state.hiddenTimer);
      state.hiddenTimer = setTimeout(() => {
        if (state.socket && state.socket.connected) {
          state.pausedByHidden = true;
          state.socket.disconnect();
        }
      }, 45_000);
    } else {
      if (state.hiddenTimer) {
        clearTimeout(state.hiddenTimer);
        state.hiddenTimer = null;
      }
      if (state.pausedByHidden && state.socket && !state.socket.connected) {
        state.pausedByHidden = false;
        state.socket.connect();
      }
    }
  });
}

export function getRealtimeSocket(): Socket | null {
  return state.socket;
}

export async function ensureRealtimeSocket(): Promise<Socket | null> {
  if (typeof window === "undefined") return null;
  if (state.socket) {
    if (!state.socket.connected && state.pausedByHidden) {
      state.pausedByHidden = false;
      state.socket.connect();
    }
    return state.socket;
  }
  if (state.initPromise) return state.initPromise;

  bindVisibilityLifecycle();

  state.initPromise = import("socket.io-client")
    .then(({ io }) => {
      if (state.socket) return state.socket;
      const baseUrl =
        process.env.NEXT_PUBLIC_REALTIME_URL && process.env.NEXT_PUBLIC_REALTIME_URL.length > 0
          ? process.env.NEXT_PUBLIC_REALTIME_URL
          : undefined;

      const socket = io(baseUrl, {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 600,
        reconnectionDelayMax: 8000,
        randomizationFactor: 0.5,
        timeout: 4000,
      });

      socket.on("connect", () => notifyStatus(true));
      socket.on("disconnect", () => notifyStatus(false));
      socket.on("connect_error", () => {
        notifyStatus(false);
        notifyFailure(true);
      });
      socket.io.on("reconnect_failed", () => {
        notifyFailure(true);
      });

      state.socket = socket;
      return socket;
    })
    .catch(() => {
      notifyFailure(true);
      return null;
    })
    .finally(() => {
      state.initPromise = null;
    });

  return state.initPromise;
}

/**
 * Forces a clean WebSocket handshake so newly issued HttpOnly cookies
 * (e.g. first guest token or login session) attach to the upgrade request
 * without detaching existing hook event listeners.
 */
export function reconnectRealtimeSocket() {
  state.failed = false;
  if (state.socket) {
    state.socket.disconnect();
    state.socket.connect();
    return;
  }
  void ensureRealtimeSocket();
}

export function subscribeSocketStatus(listener: (connected: boolean) => void): () => void {
  statusListeners.add(listener);
  listener(state.connected);
  return () => statusListeners.delete(listener);
}

export async function emitJoinConversation(
  conversationId: string,
  afterSeq?: number,
): Promise<ChatMessageDTO[] | null> {
  const socket = await ensureRealtimeSocket();
  if (!socket || !socket.connected) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    socket.emit(
      "join_conversation",
      { conversationId, afterSeq },
      (ack: { ok?: boolean; data?: { messages?: ChatMessageDTO[] } | null }) => {
        clearTimeout(timer);
        if (ack?.ok && ack.data?.messages) {
          resolve(ack.data.messages);
        } else {
          resolve(null);
        }
      },
    );
  });
}

export async function sendRealtimeChatMessage(payload: {
  conversationId: string;
  type: "TEXT" | "IMAGE" | "PRODUCT" | "REQUEST" | "ORDER";
  body: string;
  clientTempId: string;
  refId?: string | null;
  attachments?: Array<{
    storageKey: string;
    thumbKey?: string;
    mimeType?: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    originalName?: string;
  }>;
}): Promise<{ message: ChatMessageDTO; deduplicated?: boolean }> {
  const socket = state.socket ?? (await ensureRealtimeSocket());
  if (socket && socket.connected) {
    const viaSocket = await new Promise<{
      ok?: boolean;
      status?: number;
      error?: string;
      data?: { message: ChatMessageDTO; deduplicated?: boolean };
    } | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 7000);
      socket.emit(
        "send_message",
        payload,
        (ack: {
          ok?: boolean;
          status?: number;
          error?: string;
          data?: { message: ChatMessageDTO; deduplicated?: boolean };
        }) => {
          clearTimeout(timer);
          resolve(ack);
        },
      );
    });

    if (viaSocket?.ok && viaSocket.data?.message) {
      return viaSocket.data;
    }
    if (viaSocket && viaSocket.ok === false) {
      if (viaSocket.status === 401 || viaSocket.status === 403) {
        reconnectRealtimeSocket();
      } else if (viaSocket.error) {
        throw new Error(viaSocket.error);
      }
    }
  }

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `/api/chat/conversations/${encodeURIComponent(payload.conversationId)}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          type: payload.type,
          body: payload.body,
          clientTempId: payload.clientTempId,
          refId: payload.refId,
          attachments: payload.attachments,
        }),
      },
    );
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { message: ChatMessageDTO; deduplicated?: boolean };
      error?: unknown;
    } | null;
    if (!res.ok || !json?.data?.message) {
      throw new Error(extractApiErrorMessage(json, "Unable to send message."));
    }
    return json.data;
  } finally {
    clearTimeout(abortTimer);
  }
}

export function emitRealtimeTyping(conversationId: string, isTyping: boolean) {
  const now = Date.now();
  if (isTyping) {
    const last = typingLastSentAt.get(conversationId) ?? 0;
    if (now - last < 2000) return;
    typingLastSentAt.set(conversationId, now);
  } else {
    typingLastSentAt.delete(conversationId);
  }

  const socket = getRealtimeSocket();
  if (socket && socket.connected) {
    socket.emit("typing", { conversationId, isTyping });
    return;
  }
  void fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/typing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ isTyping }),
  }).catch(() => undefined);
}

export function markRealtimeConversationRead(
  conversationId: string,
  lastReadSeq?: number,
): Promise<void> {
  if (typeof lastReadSeq === "number") {
    const prev = readMaxSeqPending.get(conversationId) ?? 0;
    if (lastReadSeq > prev) {
      readMaxSeqPending.set(conversationId, lastReadSeq);
    }
  }

  const existingTimer = readDebounceTimers.get(conversationId);
  if (existingTimer) clearTimeout(existingTimer);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      readDebounceTimers.delete(conversationId);
      const effectiveSeq = readMaxSeqPending.get(conversationId) ?? lastReadSeq;
      readMaxSeqPending.delete(conversationId);

      const socket = getRealtimeSocket();
      if (socket && socket.connected) {
        socket.emit("mark_read", { conversationId, lastReadSeq: effectiveSeq });
        resolve();
        return;
      }
      void fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lastReadSeq: effectiveSeq }),
      })
        .catch(() => undefined)
        .finally(() => resolve());
    }, 500);

    readDebounceTimers.set(conversationId, timer);
  });
}

export function useConversationRealtime(params: {
  conversationId: string | null;
  enabled?: boolean;
  latestSeqRef: React.MutableRefObject<number>;
  onMessage: (message: ChatMessageDTO) => void;
  onRead?: (payload: { readerRole: string; lastReadSeq: number; readAt: string }) => void;
  onTyping?: (payload: { actorRole: string; actorName: string; isTyping: boolean }) => void;
  onConversationUpdate?: (payload: {
    status?: string;
    assignedToId?: string | null;
    tags?: string[];
  }) => void;
  onSyncMessages?: (messages: ChatMessageDTO[]) => void;
}) {
  const {
    conversationId,
    enabled = true,
    latestSeqRef,
    onMessage,
    onRead,
    onTyping,
    onConversationUpdate,
    onSyncMessages,
  } = params;

  const callbacksRef = React.useRef({
    onMessage,
    onRead,
    onTyping,
    onConversationUpdate,
    onSyncMessages,
  });
  React.useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onRead,
      onTyping,
      onConversationUpdate,
      onSyncMessages,
    };
  }, [onMessage, onRead, onTyping, onConversationUpdate, onSyncMessages]);

  const [socketConnected, setSocketConnected] = React.useState(state.connected);
  const [sseKey, setSseKey] = React.useState<string | null>(null);
  const activeKey = enabled && conversationId ? `${enabled}:${conversationId}` : null;
  const sseAllowed = Boolean(activeKey && sseKey === activeKey && !socketConnected);

  React.useEffect(() => {
    if (!enabled || !conversationId || !activeKey) return;
    let disposed = false;
    let attachedSocket: Socket | null = null;

    const unsubStatus = subscribeSocketStatus((connected) => {
      setSocketConnected(connected);
      if (connected) setSseKey(null);
    });

    // Only activate SSE fallback if Socket.IO fails to connect within 1500ms or emits failure
    const fallbackTimer = setTimeout(() => {
      if (!disposed && !state.connected) {
        setSseKey(activeKey);
      }
    }, 1500);
    const unsubFailure = (() => {
      const fn = (failed: boolean) => {
        if (failed && !disposed) setSseKey(activeKey);
      };
      failureListeners.add(fn);
      return () => failureListeners.delete(fn);
    })();

    async function joinAndSync(afterOverride?: number) {
      if (!conversationId) return;
      const since = afterOverride ?? latestSeqRef.current;
      const missed = await emitJoinConversation(conversationId, since > 0 ? since : undefined);
      if (missed && missed.length > 0) {
        callbacksRef.current.onSyncMessages?.(missed);
      }
    }

    function handleMessage(evt: { conversationId?: string; message?: ChatMessageDTO }) {
      if (evt?.conversationId !== conversationId || !evt.message) return;
      callbacksRef.current.onMessage(evt.message);
    }

    function handleRead(evt: {
      conversationId?: string;
      readerRole?: string;
      lastReadSeq?: number;
      readAt?: string;
    }) {
      if (evt?.conversationId !== conversationId) return;
      callbacksRef.current.onRead?.({
        readerRole: evt.readerRole ?? "CUSTOMER",
        lastReadSeq: evt.lastReadSeq ?? 0,
        readAt: evt.readAt ?? new Date().toISOString(),
      });
    }

    function handleTyping(evt: {
      conversationId?: string;
      actorRole?: string;
      actorName?: string;
      isTyping?: boolean;
    }) {
      if (evt?.conversationId !== conversationId) return;
      callbacksRef.current.onTyping?.({
        actorRole: evt.actorRole ?? "CUSTOMER",
        actorName: evt.actorName ?? "",
        isTyping: Boolean(evt.isTyping),
      });
    }

    function handleConv(evt: {
      conversationId?: string;
      status?: string;
      assignedToId?: string | null;
      tags?: string[];
    }) {
      if (evt?.conversationId !== conversationId) return;
      callbacksRef.current.onConversationUpdate?.(evt);
    }

    function handleConnect() {
      void joinAndSync(latestSeqRef.current);
    }

    void ensureRealtimeSocket().then((socket) => {
      if (disposed || !socket) {
        if (!disposed) setSseKey(activeKey);
        return;
      }
      attachedSocket = socket;
      socket.on("connect", handleConnect);
      socket.on("chat:message", handleMessage);
      socket.on("chat:read", handleRead);
      socket.on("chat:typing", handleTyping);
      socket.on("chat:conversation", handleConv);
      if (socket.connected) {
        void joinAndSync();
      }
    });

    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      unsubStatus();
      unsubFailure();
      if (attachedSocket) {
        attachedSocket.emit("leave_conversation", { conversationId });
        attachedSocket.off("connect", handleConnect);
        attachedSocket.off("chat:message", handleMessage);
        attachedSocket.off("chat:read", handleRead);
        attachedSocket.off("chat:typing", handleTyping);
        attachedSocket.off("chat:conversation", handleConv);
      }
    };
  }, [conversationId, enabled, activeKey, latestSeqRef]);

  // SSE fallback ONLY if Socket.IO failed or could not establish within fallback grace period
  React.useEffect(() => {
    if (!enabled || !conversationId || socketConnected || !sseAllowed) return;

    const es = new EventSource(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/stream`,
    );

    const onSseMessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { message?: ChatMessageDTO };
        if (parsed.message) {
          callbacksRef.current.onMessage(parsed.message);
        }
      } catch {
        // Ignore parse failure
      }
    };
    const onSseRead = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as {
          readerRole?: string;
          lastReadSeq?: number;
          readAt?: string;
        };
        callbacksRef.current.onRead?.({
          readerRole: parsed.readerRole ?? "CUSTOMER",
          lastReadSeq: parsed.lastReadSeq ?? 0,
          readAt: parsed.readAt ?? new Date().toISOString(),
        });
      } catch {
        // Ignore parse failure
      }
    };
    const onSseTyping = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as {
          actorRole?: string;
          actorName?: string;
          isTyping?: boolean;
        };
        callbacksRef.current.onTyping?.({
          actorRole: parsed.actorRole ?? "CUSTOMER",
          actorName: parsed.actorName ?? "",
          isTyping: Boolean(parsed.isTyping),
        });
      } catch {
        // Ignore
      }
    };
    const onSseConv = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as {
          status?: string;
          assignedToId?: string | null;
          tags?: string[];
        };
        callbacksRef.current.onConversationUpdate?.(parsed);
      } catch {
        // Ignore
      }
    };

    es.addEventListener("chat:message", onSseMessage);
    es.addEventListener("chat:read", onSseRead);
    es.addEventListener("chat:typing", onSseTyping);
    es.addEventListener("chat:conversation", onSseConv);

    return () => {
      es.removeEventListener("chat:message", onSseMessage);
      es.removeEventListener("chat:read", onSseRead);
      es.removeEventListener("chat:typing", onSseTyping);
      es.removeEventListener("chat:conversation", onSseConv);
      es.close();
    };
  }, [conversationId, enabled, socketConnected, sseAllowed]);

  return { socketConnected };
}

export function useAdminInboxRealtime(params: {
  enabled: boolean;
  onInboxEvent: (evt: { type: string; payload: Record<string, unknown> }) => void;
}) {
  const { enabled, onInboxEvent } = params;
  const callbackRef = React.useRef(onInboxEvent);
  React.useEffect(() => {
    callbackRef.current = onInboxEvent;
  }, [onInboxEvent]);

  const [socketConnected, setSocketConnected] = React.useState(state.connected);
  const [sseAllowed, setSseAllowed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let attachedSocket: Socket | null = null;
    const unsubStatus = subscribeSocketStatus((connected) => {
      setSocketConnected(connected);
      if (connected) setSseAllowed(false);
    });
    const fallbackTimer = setTimeout(() => {
      if (!disposed && !state.connected) setSseAllowed(true);
    }, 1500);

    const onMsg = (payload: Record<string, unknown>) =>
      callbackRef.current({ type: "chat:message", payload });
    const onConv = (payload: Record<string, unknown>) =>
      callbackRef.current({ type: "chat:conversation", payload });
    const onRead = (payload: Record<string, unknown>) =>
      callbackRef.current({ type: "chat:read", payload });

    void ensureRealtimeSocket().then((socket) => {
      if (disposed || !socket) {
        if (!disposed) setSseAllowed(true);
        return;
      }
      attachedSocket = socket;
      socket.on("chat:message", onMsg);
      socket.on("chat:conversation", onConv);
      socket.on("chat:read", onRead);
    });

    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      unsubStatus();
      if (attachedSocket) {
        attachedSocket.off("chat:message", onMsg);
        attachedSocket.off("chat:conversation", onConv);
        attachedSocket.off("chat:read", onRead);
      }
    };
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled || socketConnected || !sseAllowed) return;
    const es = new EventSource("/api/chat/admin/stream");

    const onMsg = (e: MessageEvent) => {
      try {
        callbackRef.current({ type: "chat:message", payload: JSON.parse(e.data) });
      } catch {
        // Ignore
      }
    };
    const onConv = (e: MessageEvent) => {
      try {
        callbackRef.current({ type: "chat:conversation", payload: JSON.parse(e.data) });
      } catch {
        // Ignore
      }
    };
    const onRead = (e: MessageEvent) => {
      try {
        callbackRef.current({ type: "chat:read", payload: JSON.parse(e.data) });
      } catch {
        // Ignore
      }
    };

    es.addEventListener("chat:message", onMsg);
    es.addEventListener("chat:conversation", onConv);
    es.addEventListener("chat:read", onRead);

    return () => {
      es.removeEventListener("chat:message", onMsg);
      es.removeEventListener("chat:conversation", onConv);
      es.removeEventListener("chat:read", onRead);
      es.close();
    };
  }, [enabled, socketConnected, sseAllowed]);
}

export function useUserCustomizationsRealtime(params: {
  targetKey?: string;
  enabled: boolean;
  onCustomizationEvent: (evt: Record<string, unknown>) => void;
}) {
  const { enabled, onCustomizationEvent } = params;
  const callbackRef = React.useRef(onCustomizationEvent);
  React.useEffect(() => {
    callbackRef.current = onCustomizationEvent;
  }, [onCustomizationEvent]);

  React.useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let attachedSocket: Socket | null = null;
    const handler = (payload: Record<string, unknown>) => {
      callbackRef.current(payload);
    };

    void ensureRealtimeSocket().then((socket) => {
      if (disposed || !socket) return;
      attachedSocket = socket;
      socket.on("customization:updated", handler);
    });

    return () => {
      disposed = true;
      if (attachedSocket) {
        attachedSocket.off("customization:updated", handler);
      }
    };
  }, [enabled]);
}
