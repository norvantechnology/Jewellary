"use client";

import type {
  ChatBootstrapDTO,
  ChatConversationDetailDTO,
  ChatMessageDTO,
  ChatRefSnapshotOrder,
  ChatRefSnapshotProduct,
  ChatRefSnapshotRequest,
} from "@/modules/chat/chat.service";

export interface LocalClientChatMessage extends ChatMessageDTO {
  localStatus?: "sending" | "failed";
  localError?: string;
}

interface CachedProductSearchEntry {
  products: ChatRefSnapshotProduct[];
  nextCursor: string | null;
  requests: ChatRefSnapshotRequest[];
  orders: ChatRefSnapshotOrder[];
  expiresAt: number;
}

const BOOTSTRAP_STORAGE_KEY = "atelier:chat:bootstrap:v1";
const THREAD_STORAGE_PREFIX = "atelier:chat:thread:v1:";
const PRODUCTS_STORAGE_KEY = "atelier:chat:products:v1";
const NOTICE_DISMISSED_KEY = "atelier:chat:notice-dismissed:v1";

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const IDB_NAME = "atelier-concierge-cache";
const IDB_STORE = "kv";
const IDB_VERSION = 1;

let memoryBootstrap: ChatBootstrapDTO | null = null;
const memoryThreads = new Map<string, ChatConversationDetailDTO>();
const memoryProducts = new Map<string, CachedProductSearchEntry>();
let inflightBootstrapPromise: Promise<ChatBootstrapDTO | null> | null = null;
let inflightProductPrefetch: Promise<CachedProductSearchEntry | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function getCachedBootstrapSync(): ChatBootstrapDTO | null {
  if (memoryBootstrap) return memoryBootstrap;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOTSTRAP_STORAGE_KEY);
    if (!raw) return null;
    memoryBootstrap = JSON.parse(raw) as ChatBootstrapDTO;
    return memoryBootstrap;
  } catch {
    return null;
  }
}

export async function getCachedBootstrapAsync(): Promise<ChatBootstrapDTO | null> {
  const syncVal = getCachedBootstrapSync();
  if (syncVal) return syncVal;
  const fromIdb = await idbGet<ChatBootstrapDTO>(BOOTSTRAP_STORAGE_KEY);
  if (fromIdb) {
    memoryBootstrap = fromIdb;
  }
  return fromIdb;
}

export function saveCachedBootstrap(data: ChatBootstrapDTO): void {
  memoryBootstrap = data;
  if (data.activeDetail) {
    saveCachedThread(data.activeDetail);
  }
  if (typeof window === "undefined") return;
  try {
    const trimmed: ChatBootstrapDTO = {
      ...data,
      activeDetail: data.activeDetail
        ? {
            ...data.activeDetail,
            messages: data.activeDetail.messages.slice(-30),
          }
        : null,
    };
    window.sessionStorage.setItem(BOOTSTRAP_STORAGE_KEY, JSON.stringify(trimmed));
    void idbSet(BOOTSTRAP_STORAGE_KEY, trimmed);
  } catch {
    // Ignore storage quota issues cleanly
  }
}

export function getCachedThreadSync(conversationId: string): ChatConversationDetailDTO | null {
  const mem = memoryThreads.get(conversationId);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${THREAD_STORAGE_PREFIX}${conversationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatConversationDetailDTO;
    memoryThreads.set(conversationId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function getCachedThreadAsync(
  conversationId: string,
): Promise<ChatConversationDetailDTO | null> {
  const sync = getCachedThreadSync(conversationId);
  if (sync) return sync;
  const fromIdb = await idbGet<ChatConversationDetailDTO>(
    `${THREAD_STORAGE_PREFIX}${conversationId}`,
  );
  if (fromIdb) {
    memoryThreads.set(conversationId, fromIdb);
  }
  return fromIdb;
}

export function saveCachedThread(detail: ChatConversationDetailDTO): void {
  const trimmed: ChatConversationDetailDTO = {
    ...detail,
    messages: detail.messages.slice(-30),
  };
  memoryThreads.set(detail.conversation.id, trimmed);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${THREAD_STORAGE_PREFIX}${detail.conversation.id}`,
      JSON.stringify(trimmed),
    );
    void idbSet(`${THREAD_STORAGE_PREFIX}${detail.conversation.id}`, trimmed);
  } catch {
    // Ignore quota limits
  }
}

export function updateCachedThreadMessages(
  conversationId: string,
  messages: ChatMessageDTO[],
): void {
  const existing = memoryThreads.get(conversationId);
  if (!existing) return;
  const persistedOnly = messages.filter((m) => m.seq > 0).slice(-30);
  if (persistedOnly.length === 0) return;
  saveCachedThread({
    ...existing,
    messages: persistedOnly,
    newestSeq: persistedOnly[persistedOnly.length - 1]?.seq ?? existing.newestSeq,
  });
}

export async function fetchAndCacheChatBootstrap(
  conversationId?: string | null,
): Promise<ChatBootstrapDTO | null> {
  if (!conversationId && inflightBootstrapPromise) {
    return inflightBootstrapPromise;
  }
  const url = conversationId
    ? `/api/chat/bootstrap?conversationId=${encodeURIComponent(conversationId)}&limit=30`
    : "/api/chat/bootstrap?limit=30";

  const req = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: ChatBootstrapDTO;
      } | null;
      if (json?.ok && json.data) {
        saveCachedBootstrap(json.data);
        return json.data;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      if (!conversationId) {
        inflightBootstrapPromise = null;
      }
    });

  if (!conversationId) {
    inflightBootstrapPromise = req;
  }
  return req;
}

export function getCachedShareProducts(key: string): CachedProductSearchEntry | null {
  const mem = memoryProducts.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem;
  }
  if (typeof window === "undefined") return null;
  try {
    if (key === "default:1" || key === "default:0") {
      const raw = window.sessionStorage.getItem(`${PRODUCTS_STORAGE_KEY}:${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedProductSearchEntry;
      if (parsed.expiresAt > Date.now()) {
        memoryProducts.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveCachedShareProducts(
  key: string,
  entry: Omit<CachedProductSearchEntry, "expiresAt">,
): CachedProductSearchEntry {
  const full: CachedProductSearchEntry = {
    ...entry,
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
  };
  if (memoryProducts.size >= 80) {
    const oldest = memoryProducts.keys().next().value;
    if (oldest) memoryProducts.delete(oldest);
  }
  memoryProducts.set(key, full);
  if (typeof window !== "undefined" && (key === "default:1" || key === "default:0")) {
    try {
      window.sessionStorage.setItem(`${PRODUCTS_STORAGE_KEY}:${key}`, JSON.stringify(full));
    } catch {
      // ignore
    }
  }
  return full;
}

export async function prefetchShareProducts(
  includeCustomer = false,
): Promise<CachedProductSearchEntry | null> {
  const cacheKey = includeCustomer ? "default:1" : "default:0";
  const existing = getCachedShareProducts(cacheKey);
  if (existing) return existing;
  if (inflightProductPrefetch) return inflightProductPrefetch;

  inflightProductPrefetch = fetch(
    `/api/chat/products?limit=20&includeCustomer=${includeCustomer ? "1" : "0"}`,
  )
    .then((r) => r.json())
    .then(
      (json: {
        ok?: boolean;
        data?: {
          products?: ChatRefSnapshotProduct[];
          nextCursor?: string | null;
          requests?: ChatRefSnapshotRequest[];
          orders?: ChatRefSnapshotOrder[];
        };
      }) => {
        if (!json?.ok || !json.data) return null;
        return saveCachedShareProducts(cacheKey, {
          products: json.data.products ?? [],
          nextCursor: json.data.nextCursor ?? null,
          requests: json.data.requests ?? [],
          orders: json.data.orders ?? [],
        });
      },
    )
    .catch(() => null)
    .finally(() => {
      inflightProductPrefetch = null;
    });

  return inflightProductPrefetch;
}

export function isOfflineNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(NOTICE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOfflineNoticeForSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(NOTICE_DISMISSED_KEY, "1");
  } catch {
    // ignore
  }
}
