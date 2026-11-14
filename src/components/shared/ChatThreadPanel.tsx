"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  ImagePlus,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import {
  emitRealtimeTyping,
  markRealtimeConversationRead,
  sendRealtimeChatMessage,
  useConversationRealtime,
} from "@/components/providers/useChatRealtime";
import { ChatMessageRow } from "@/components/shared/ChatMessageRow";
import type { LightboxImageItem } from "@/components/shared/PrivateImageLightbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dismissOfflineNoticeForSession,
  getCachedThreadAsync,
  getCachedThreadSync,
  isOfflineNoticeDismissed,
  prefetchShareProducts,
  saveCachedThread,
  updateCachedThreadMessages,
  type LocalClientChatMessage,
} from "@/lib/chat-client-cache";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";
import { uploadPrivateCustomerImage } from "@/lib/image-client-compress";
import type {
  ChatCannedReplyDTO,
  ChatConversationDetailDTO,
  ChatMessageDTO,
} from "@/modules/chat/chat.service";

const LazyPrivateImageLightbox = dynamic(
  () => import("@/components/shared/PrivateImageLightbox").then((mod) => mod.PrivateImageLightbox),
  { ssr: false },
);

const LazyChatProductPicker = dynamic(
  () => import("@/components/shared/ChatProductPicker").then((mod) => mod.ChatProductPicker),
  { ssr: false },
);

interface QueuedImageUpload {
  localId: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  abortController?: AbortController;
  uploaded?: {
    storageKey: string;
    thumbKey: string;
    url: string;
    thumbUrl: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    originalName?: string;
  };
}

export interface ChatThreadPanelProps {
  conversationId: string;
  viewerRole: "CUSTOMER" | "ADMIN";
  suggestedPrompts?: string[];
  cannedReplies?: ChatCannedReplyDTO[];
  composerPlaceholder?: string;
  defaultShareOpen?: boolean;
  initialDetail?: ChatConversationDetailDTO | null;
  initialFiles?: File[];
  initialPendingMessages?: LocalClientChatMessage[];
  isMobileViewport?: boolean;
  onConsumeInitialFiles?: () => void;
  onDetailLoaded?: (detail: ChatConversationDetailDTO) => void;
  onNewMessage?: (message: ChatMessageDTO) => void;
  className?: string;
}

const MAX_CONCURRENT_UPLOADS = 3;
const VIRTUAL_THRESHOLD = 100;
const VIRTUAL_WINDOW_STEP = 60;
const EST_ROW_HEIGHT = 68;

function getDayGroupLabel(iso: string, labels: { today: string; yesterday: string }): string {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function mergeMessageArrays(
  prev: LocalClientChatMessage[],
  incoming: LocalClientChatMessage[],
): LocalClientChatMessage[] {
  if (incoming.length === 0) return prev;
  const byId = new Map<string, LocalClientChatMessage>();
  for (const m of prev) {
    byId.set(m.id, m);
  }
  for (const m of incoming) {
    if (m.clientTempId) {
      for (const [k, existing] of byId.entries()) {
        if (existing.clientTempId === m.clientTempId && k !== m.id) {
          byId.delete(k);
        }
      }
    }
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aPersisted = a.seq > 0;
    const bPersisted = b.seq > 0;
    if (aPersisted && bPersisted) return a.seq - b.seq;
    if (aPersisted && !bPersisted) return -1;
    if (!aPersisted && bPersisted) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

const noopSubscribe = () => () => {};

export function ChatThreadPanel({
  conversationId,
  viewerRole,
  suggestedPrompts = [],
  cannedReplies = [],
  composerPlaceholder,
  defaultShareOpen = false,
  initialDetail = null,
  initialFiles,
  initialPendingMessages,
  isMobileViewport = false,
  onConsumeInitialFiles,
  onDetailLoaded,
  onNewMessage,
  className = "",
}: ChatThreadPanelProps) {
  const ui = useUiText();
  const dayLabels = React.useMemo(
    () => ({ today: ui.chat.thread.today, yesterday: ui.chat.thread.yesterday }),
    [ui.chat.thread.today, ui.chat.thread.yesterday],
  );
  const { formatPrice } = useCurrency();

  // The browser-only thread cache must not be read during hydration (server has no cache),
  // otherwise server/client markup diverges. After hydration (client navigations) it's safe.
  const isHydrated = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const initialCached = React.useMemo(() => {
    if (initialDetail && initialDetail.conversation.id === conversationId) {
      return initialDetail;
    }
    return isHydrated ? getCachedThreadSync(conversationId) : null;
  }, [conversationId, initialDetail, isHydrated]);

  const [loading, setLoading] = React.useState(!initialCached);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [detail, setDetail] = React.useState<ChatConversationDetailDTO | null>(initialCached);
  const [messages, setMessages] = React.useState<LocalClientChatMessage[]>(() => {
    const base = initialCached?.messages ?? [];
    return initialPendingMessages?.length ? mergeMessageArrays(base, initialPendingMessages) : base;
  });
  const [hasMoreOlder, setHasMoreOlder] = React.useState(initialCached?.hasMoreOlder ?? false);
  const [noticeDismissed, setNoticeDismissed] = React.useState(() => isOfflineNoticeDismissed());

  // Isolated composer input state
  const [text, setText] = React.useState("");
  const [typingLabel, setTypingLabel] = React.useState<string | null>(null);
  const [queuedImages, setQueuedImages] = React.useState<QueuedImageUpload[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = React.useState(false);
  const [lightboxImages, setLightboxImages] = React.useState<LightboxImageItem[]>([]);
  const [lightboxIdx, setLightboxIdx] = React.useState<number | null>(null);
  const [shareOpen, setShareOpen] = React.useState(defaultShareOpen);
  const [cannedOpen, setCannedOpen] = React.useState(false);

  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);
  const [unseenIncomingCount, setUnseenIncomingCount] = React.useState(0);
  const [windowVisibleCount, setWindowVisibleCount] = React.useState(VIRTUAL_WINDOW_STEP);

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const latestSeqRef = React.useRef(initialCached?.newestSeq ?? 0);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearBottomRef = React.useRef(true);
  const etagRef = React.useRef<string | null>(null);
  const detailCallbackRef = React.useRef(onDetailLoaded);
  const newMsgCallbackRef = React.useRef(onNewMessage);

  // Concurrency tracker for uploads
  const activeUploadsRef = React.useRef(0);
  const uploadQueueRef = React.useRef<Array<{ localId: string; file: File }>>([]);

  React.useEffect(() => {
    detailCallbackRef.current = onDetailLoaded;
  }, [onDetailLoaded]);
  React.useEffect(() => {
    newMsgCallbackRef.current = onNewMessage;
  }, [onNewMessage]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowJumpToLatest(false);
    setUnseenIncomingCount(0);
  }, []);

  const mergeMessages = React.useCallback(
    (incoming: LocalClientChatMessage[]) => {
      if (incoming.length === 0) return;
      setMessages((prev) => {
        const next = mergeMessageArrays(prev, incoming);
        const persisted = next.filter((m) => m.seq > 0);
        const newest = persisted[persisted.length - 1]?.seq ?? 0;
        if (newest > latestSeqRef.current) {
          latestSeqRef.current = newest;
        }
        updateCachedThreadMessages(conversationId, persisted);
        return next;
      });
    },
    [conversationId],
  );

  // Hydrate cache then SWR reconcile with backend
  React.useEffect(() => {
    let cancelled = false;
    etagRef.current = null;
    setWindowVisibleCount(VIRTUAL_WINDOW_STEP);

    const syncCached =
      initialDetail && initialDetail.conversation.id === conversationId
        ? initialDetail
        : getCachedThreadSync(conversationId);

    if (syncCached) {
      setDetail(syncCached);
      setMessages((prev) =>
        mergeMessageArrays(
          syncCached.messages,
          prev.filter((p) => p.seq <= 0),
        ),
      );
      setHasMoreOlder(syncCached.hasMoreOlder);
      latestSeqRef.current = Math.max(latestSeqRef.current, syncCached.newestSeq);
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom("auto"));
    } else {
      setLoading(true);
      setMessages(initialPendingMessages ?? []);
      latestSeqRef.current = 0;
    }

    async function reconcile() {
      try {
        if (!syncCached) {
          const idbCached = await getCachedThreadAsync(conversationId);
          if (idbCached && !cancelled) {
            setDetail(idbCached);
            setMessages((prev) => mergeMessageArrays(idbCached.messages, prev));
            setHasMoreOlder(idbCached.hasMoreOlder);
            latestSeqRef.current = Math.max(latestSeqRef.current, idbCached.newestSeq);
            setLoading(false);
            requestAnimationFrame(() => scrollToBottom("auto"));
          }
        }

        const shouldFetchFastMessagesOnly = Boolean(syncCached) && viewerRole === "CUSTOMER";

        if (shouldFetchFastMessagesOnly) {
          const res = await fetch(
            `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=30`,
            {
              headers: etagRef.current ? { "If-None-Match": etagRef.current } : undefined,
            },
          );
          if (res.status === 304) return;
          const etag = res.headers.get("etag");
          if (etag) etagRef.current = etag;
          const json = (await res.json().catch(() => null)) as {
            ok?: boolean;
            data?: {
              messages?: ChatMessageDTO[];
              hasMoreOlder?: boolean;
              newestSeq?: number;
            };
          } | null;
          if (res.ok && json?.data?.messages && !cancelled) {
            setHasMoreOlder(Boolean(json.data.hasMoreOlder));
            mergeMessages(json.data.messages);
            if ((json.data.newestSeq ?? 0) > 0) {
              void markRealtimeConversationRead(conversationId, json.data.newestSeq);
            }
          }
          return;
        }

        const res = await fetch(
          `/api/chat/conversations/${encodeURIComponent(conversationId)}?limit=30`,
        );
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: ChatConversationDetailDTO;
          error?: unknown;
        } | null;
        if (!res.ok || !json?.data) {
          throw new Error(extractApiErrorMessage(json, "Unable to load conversation."));
        }
        if (cancelled) return;
        setDetail(json.data);
        setHasMoreOlder(json.data.hasMoreOlder);
        latestSeqRef.current = json.data.newestSeq;
        saveCachedThread(json.data);
        setMessages((prev) =>
          mergeMessageArrays(
            json.data!.messages,
            prev.filter((p) => p.seq <= 0),
          ),
        );
        detailCallbackRef.current?.(json.data);

        requestAnimationFrame(() => {
          scrollToBottom("auto");
        });

        if (json.data.newestSeq > 0) {
          void markRealtimeConversationRead(conversationId, json.data.newestSeq);
        }
      } catch (err) {
        if (!cancelled && !syncCached) {
          toast.error(err instanceof Error ? err.message : "Failed to load chat.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void reconcile();
    const warmupTimer = setTimeout(() => {
      void import("@/components/shared/ChatProductPicker");
      void import("@/components/shared/PrivateImageLightbox");
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(warmupTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerRole]);

  // Realtime WS / fallback SSE listeners
  useConversationRealtime({
    conversationId,
    latestSeqRef,
    onMessage: (msg) => {
      mergeMessages([msg]);
      newMsgCallbackRef.current?.(msg);

      const isFromOpposite =
        (viewerRole === "CUSTOMER" && msg.senderRole !== "CUSTOMER") ||
        (viewerRole === "ADMIN" && msg.senderRole === "CUSTOMER");

      if (nearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
        if (isFromOpposite) {
          void markRealtimeConversationRead(conversationId, msg.seq);
        }
      } else if (isFromOpposite) {
        setShowJumpToLatest(true);
        setUnseenIncomingCount((c) => c + 1);
      }
    },
    onSyncMessages: (missed) => {
      mergeMessages(missed);
      const maxMissedSeq = missed[missed.length - 1]?.seq ?? 0;
      if (maxMissedSeq > 0 && nearBottomRef.current) {
        void markRealtimeConversationRead(conversationId, maxMissedSeq);
        requestAnimationFrame(() => scrollToBottom("auto"));
      }
    },
    onRead: (evt) => {
      const oppositeRead =
        (viewerRole === "CUSTOMER" && evt.readerRole !== "CUSTOMER") ||
        (viewerRole === "ADMIN" && evt.readerRole === "CUSTOMER");
      if (!oppositeRead) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.seq > 0 && m.seq <= evt.lastReadSeq && !m.readAt ? { ...m, readAt: evt.readAt } : m,
        ),
      );
    },
    onTyping: (evt) => {
      const fromOther =
        (viewerRole === "CUSTOMER" && evt.actorRole !== "CUSTOMER") ||
        (viewerRole === "ADMIN" && evt.actorRole === "CUSTOMER");
      if (!fromOther) return;
      setTypingLabel(evt.isTyping ? `${evt.actorName} is typing…` : null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (evt.isTyping) {
        typingTimerRef.current = setTimeout(() => setTypingLabel(null), 3500);
      }
    },
  });

  async function loadOlderMessages() {
    const firstPersisted = messages.find((m) => m.seq > 0);
    if (loadingOlder || !hasMoreOlder || !firstPersisted) return;
    const oldestSeq = firstPersisted.seq;

    const el = scrollContainerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;

    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?cursor=${oldestSeq}&limit=30`,
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { messages?: ChatMessageDTO[]; hasMoreOlder?: boolean };
      } | null;
      if (res.ok && json?.data?.messages) {
        setHasMoreOlder(Boolean(json.data.hasMoreOlder));
        setWindowVisibleCount((c) => c + (json.data?.messages?.length ?? 0));
        mergeMessages(json.data.messages);
        requestAnimationFrame(() => {
          if (el) {
            el.scrollTop = Math.max(0, el.scrollHeight - prevHeight);
          }
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom < 90;
    nearBottomRef.current = isNear;
    if (isNear) {
      setShowJumpToLatest(false);
      if (unseenIncomingCount > 0 && latestSeqRef.current > 0) {
        setUnseenIncomingCount(0);
        void markRealtimeConversationRead(conversationId, latestSeqRef.current);
      }
    } else if (distanceFromBottom > 180) {
      setShowJumpToLatest(true);
    }

    if (el.scrollTop < 64) {
      if (windowVisibleCount < timelineEntries.length) {
        const prevH = el.scrollHeight;
        setWindowVisibleCount((c) => Math.min(timelineEntries.length, c + VIRTUAL_WINDOW_STEP));
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollTop + Math.max(0, el.scrollHeight - prevH);
        });
      } else if (hasMoreOlder && !loadingOlder) {
        void loadOlderMessages();
      }
    }
  }

  function autoResizeTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  const pumpUploadQueue = React.useCallback(() => {
    while (activeUploadsRef.current < MAX_CONCURRENT_UPLOADS && uploadQueueRef.current.length > 0) {
      const next = uploadQueueRef.current.shift()!;
      activeUploadsRef.current += 1;
      const controller = new AbortController();

      setQueuedImages((prev) =>
        prev.map((q) =>
          q.localId === next.localId
            ? { ...q, status: "uploading", abortController: controller }
            : q,
        ),
      );

      uploadPrivateCustomerImage({
        file: next.file,
        endpointPrefix: "/api/chat/uploads",
        signal: controller.signal,
        onProgress: (pct) => {
          setQueuedImages((prev) =>
            prev.map((q) => (q.localId === next.localId ? { ...q, progress: pct } : q)),
          );
        },
      })
        .then((uploaded) => {
          setQueuedImages((prev) =>
            prev.map((q) =>
              q.localId === next.localId
                ? { ...q, status: "done", progress: 100, uploaded, abortController: undefined }
                : q,
            ),
          );
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setQueuedImages((prev) =>
            prev.map((q) =>
              q.localId === next.localId
                ? {
                    ...q,
                    status: "error",
                    abortController: undefined,
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : q,
            ),
          );
        })
        .finally(() => {
          activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
          pumpUploadQueue();
        });
    }
  }, []);

  const retryUploadItem = React.useCallback(
    (localId: string, file: File) => {
      setQueuedImages((prev) =>
        prev.map((q) =>
          q.localId === localId ? { ...q, status: "queued", progress: 10, error: undefined } : q,
        ),
      );
      uploadQueueRef.current.push({ localId, file });
      pumpUploadQueue();
    },
    [pumpUploadQueue],
  );

  const processFileQueue = React.useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const availableSlots = 5 - queuedImages.length;
      if (availableSlots <= 0) {
        toast.error(ui.chat.thread.maxImages);
        return;
      }

      const picked = Array.from(files).slice(0, availableSlots);
      const added: QueuedImageUpload[] = [];
      for (const file of picked) {
        if (file.size > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES * 3.2) {
          toast.error(`"${file.name}" exceeds the 5 MB image limit.`);
          continue;
        }
        const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = URL.createObjectURL(file);
        added.push({ localId, file, previewUrl, progress: 10, status: "queued" });
        uploadQueueRef.current.push({ localId, file });
      }
      if (added.length > 0) {
        setQueuedImages((prev) => [...prev, ...added]);
        pumpUploadQueue();
      }
    },
    [queuedImages.length, pumpUploadQueue, ui.chat.thread.maxImages],
  );

  React.useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) return;
    void processFileQueue(initialFiles);
    onConsumeInitialFiles?.();
  }, [initialFiles, onConsumeInitialFiles, processFileQueue]);

  function removeQueuedImage(localId: string) {
    uploadQueueRef.current = uploadQueueRef.current.filter((item) => item.localId !== localId);
    setQueuedImages((prev) => {
      const target = prev.find((q) => q.localId === localId);
      if (target) {
        target.abortController?.abort();
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((q) => q.localId !== localId);
    });
  }

  const dispatchOptimisticMessage = React.useCallback(
    async (params: {
      body: string;
      type: "TEXT" | "IMAGE" | "PRODUCT" | "REQUEST" | "ORDER";
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
      existingTempId?: string;
    }) => {
      const clientTempId =
        params.existingTempId ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const nowIso = new Date().toISOString();

      const optimisticRow: LocalClientChatMessage = {
        id: clientTempId,
        seq: 0,
        conversationId,
        senderId: null,
        senderRole: viewerRole,
        senderName: viewerRole === "ADMIN" ? ui.chat.thread.teamName : ui.chat.you,
        type: params.type,
        body: params.body,
        attachments: (params.attachments ?? []).map((a) => ({
          storageKey: a.storageKey,
          thumbKey: a.thumbKey,
          url: "",
          thumbUrl: "",
          mimeType: a.mimeType ?? "image/webp",
          sizeBytes: a.sizeBytes,
          width: a.width,
          height: a.height,
          originalName: a.originalName,
          expiresAt: nowIso,
        })),
        refId: params.refId ?? null,
        refSnapshot: null,
        clientTempId,
        deliveredAt: null,
        readAt: null,
        createdAt: nowIso,
        localStatus: "sending",
      };

      setMessages((prev) =>
        mergeMessageArrays(
          prev.filter((m) => m.id !== clientTempId),
          [optimisticRow],
        ),
      );
      requestAnimationFrame(() => scrollToBottom("smooth"));

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Message timed out. Tap to retry.")), 8000),
      );

      try {
        const res = await Promise.race([
          sendRealtimeChatMessage({
            conversationId,
            type: params.type,
            body: params.body,
            clientTempId,
            refId: params.refId,
            attachments: params.attachments,
          }),
          timeoutPromise,
        ]);
        mergeMessages([res.message]);
        newMsgCallbackRef.current?.(res.message);
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientTempId === clientTempId || m.id === clientTempId
              ? {
                  ...m,
                  localStatus: "failed",
                  localError: err instanceof Error ? err.message : "Failed to send message.",
                }
              : m,
          ),
        );
      }
    },
    [
      conversationId,
      mergeMessages,
      scrollToBottom,
      viewerRole,
      ui.chat.thread.teamName,
      ui.chat.you,
    ],
  );

  async function handleSend(overrideBody?: string) {
    const body = (overrideBody ?? text).trim();
    const uploadingNow = queuedImages.some(
      (q) => q.status === "uploading" || q.status === "queued",
    );
    if (uploadingNow) {
      toast.error(ui.chat.thread.waitUploads);
      return;
    }
    const hasFailed = queuedImages.some((q) => q.status === "error");
    if (hasFailed) {
      toast.error(ui.chat.thread.failedUploads);
      return;
    }

    const readyAttachments = queuedImages
      .filter((q) => q.status === "done" && q.uploaded)
      .map((q) => q.uploaded!);

    if (!body && readyAttachments.length === 0) return;

    // Clear composer immediately without waiting for network ACK
    if (!overrideBody) {
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
    for (const q of queuedImages) {
      URL.revokeObjectURL(q.previewUrl);
    }
    setQueuedImages([]);
    emitRealtimeTyping(conversationId, false);

    const payloadAttachments = readyAttachments.map((att) => ({
      storageKey: att.storageKey,
      thumbKey: att.thumbKey,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      width: att.width,
      height: att.height,
      originalName: att.originalName,
    }));

    void dispatchOptimisticMessage({
      type: readyAttachments.length > 0 && !body ? "IMAGE" : "TEXT",
      body,
      attachments: payloadAttachments,
    });
  }

  function handleRetryMessage(failedMsg: LocalClientChatMessage) {
    void dispatchOptimisticMessage({
      type:
        failedMsg.type === "SYSTEM"
          ? "TEXT"
          : (failedMsg.type as "TEXT" | "IMAGE" | "PRODUCT" | "REQUEST" | "ORDER"),
      body: failedMsg.body,
      refId: failedMsg.refId,
      attachments: failedMsg.attachments.map((att) => ({
        storageKey: att.storageKey,
        thumbKey: att.thumbKey,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
        originalName: att.originalName,
      })),
      existingTempId: failedMsg.clientTempId ?? failedMsg.id,
    });
  }

  function handleShareCard(type: "PRODUCT" | "REQUEST" | "ORDER", refId: string, label: string) {
    setShareOpen(false);
    void dispatchOptimisticMessage({
      type,
      body: label,
      refId,
    });
  }

  const ownRoleCheck = React.useCallback(
    (senderRole: ChatMessageDTO["senderRole"]) =>
      viewerRole === "CUSTOMER"
        ? senderRole === "CUSTOMER"
        : senderRole === "ADMIN" || senderRole === "STAFF",
    [viewerRole],
  );

  const hasSentCustomerMessage = React.useMemo(
    () => messages.some((m) => m.senderRole === "CUSTOMER"),
    [messages],
  );

  // Group consecutive same-sender messages within 5 minutes and same calendar day
  type TimelineEntry =
    | { type: "day"; label: string; key: string }
    | {
        type: "msg";
        msg: LocalClientChatMessage;
        isOwn: boolean;
        showSenderName: boolean;
        isGroupStart: boolean;
        isGroupEnd: boolean;
        showGroupFooter: boolean;
      };

  const timelineEntries = React.useMemo<TimelineEntry[]>(() => {
    const out: TimelineEntry[] = [];
    let currentDay = "";

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;
      const dayLabel = getDayGroupLabel(msg.createdAt, dayLabels);
      if (dayLabel !== currentDay) {
        currentDay = dayLabel;
        out.push({ type: "day", label: dayLabel, key: `day-${msg.seq}-${i}-${dayLabel}` });
      }

      if (msg.type === "SYSTEM") {
        out.push({
          type: "msg",
          msg,
          isOwn: false,
          showSenderName: false,
          isGroupStart: true,
          isGroupEnd: true,
          showGroupFooter: false,
        });
        continue;
      }

      const isOwn = ownRoleCheck(msg.senderRole);
      const prev = i > 0 ? messages[i - 1]! : null;
      const next = i + 1 < messages.length ? messages[i + 1]! : null;

      const sameGroupWithPrev =
        Boolean(prev) &&
        prev!.type !== "SYSTEM" &&
        ownRoleCheck(prev!.senderRole) === isOwn &&
        prev!.senderName === msg.senderName &&
        getDayGroupLabel(prev!.createdAt, dayLabels) === dayLabel &&
        Math.abs(new Date(msg.createdAt).getTime() - new Date(prev!.createdAt).getTime()) <=
          5 * 60 * 1000;

      const sameGroupWithNext =
        Boolean(next) &&
        next!.type !== "SYSTEM" &&
        ownRoleCheck(next!.senderRole) === isOwn &&
        next!.senderName === msg.senderName &&
        getDayGroupLabel(next!.createdAt, dayLabels) === dayLabel &&
        Math.abs(new Date(next!.createdAt).getTime() - new Date(msg.createdAt).getTime()) <=
          5 * 60 * 1000 &&
        msg.localStatus !== "failed" &&
        next!.localStatus !== "failed";

      const isGroupStart = !sameGroupWithPrev;
      const isGroupEnd = !sameGroupWithNext;

      // Remove "Guest Collector" on own customer messages; show sender name on incoming/admin groups only
      const showSenderName = isGroupStart && !isOwn;

      out.push({
        type: "msg",
        msg,
        isOwn,
        showSenderName,
        isGroupStart,
        isGroupEnd,
        showGroupFooter: isGroupEnd,
      });
    }
    return out;
  }, [messages, ownRoleCheck, dayLabels]);

  // Sliding DOM window when > 100 timeline items
  const isWindowed = timelineEntries.length > VIRTUAL_THRESHOLD;
  const startSliceIdx = isWindowed ? Math.max(0, timelineEntries.length - windowVisibleCount) : 0;
  const visibleTimeline = isWindowed ? timelineEntries.slice(startSliceIdx) : timelineEntries;
  const hiddenTopSpacerPx = isWindowed ? startSliceIdx * EST_ROW_HEIGHT : 0;

  const showOfflineBanner =
    viewerRole === "CUSTOMER" &&
    detail &&
    !detail.supportStatus.isOnline &&
    !noticeDismissed &&
    !hasSentCustomerMessage;

  return (
    <div className={`relative flex h-full min-h-0 flex-col bg-surface ${className}`}>
      {/* Slim 1-2 line dismissible offline hours banner */}
      {showOfflineBanner ? (
        <div className="flex items-start gap-2.5 border-b border-border/70 bg-surface-2/80 px-3 py-2 text-[13px] text-text-muted">
          <Clock className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
          <p className="min-w-0 flex-1 leading-snug">{ui.chat.thread.offlineNotice}</p>
          <button
            type="button"
            onClick={() => {
              dismissOfflineNoticeForSession();
              setNoticeDismissed(true);
            }}
            aria-label={ui.chat.thread.dismissNoticeAria}
            className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Message stream */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
        >
          {loading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-12 w-3/4 rounded-2xl" />
              <Skeleton className="ml-auto h-11 w-2/3 rounded-2xl" />
              <Skeleton className="h-14 w-4/5 rounded-2xl" />
            </div>
          ) : null}

          {loadingOlder ? (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-text-muted" />
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-2 py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-text">{ui.chat.emptyTitle}</p>
                <p className="text-[13px] text-text-muted">{ui.chat.thread.emptyText}</p>
              </div>
              {suggestedPrompts.length > 0 ? (
                <div className="mt-1 flex w-full max-w-[300px] flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
                  {suggestedPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-auto"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hiddenTopSpacerPx > 0 ? (
            <div style={{ height: hiddenTopSpacerPx }} aria-hidden="true" />
          ) : null}

          {visibleTimeline.map((entry) => {
            if (entry.type === "day") {
              return (
                <div key={entry.key} className="flex items-center justify-center py-2">
                  <span className="rounded-full border border-border/80 bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                    {entry.label}
                  </span>
                </div>
              );
            }

            return (
              <ChatMessageRow
                key={entry.msg.id}
                message={entry.msg}
                isOwn={entry.isOwn}
                showSenderName={entry.showSenderName}
                showGroupFooter={entry.showGroupFooter}
                isGroupStart={entry.isGroupStart}
                isGroupEnd={entry.isGroupEnd}
                viewerRole={viewerRole}
                formatPrice={formatPrice}
                onOpenLightbox={(atts, idx) => {
                  setLightboxImages(
                    atts.map((a) => ({
                      url: a.url,
                      alt: a.originalName ?? "Shared attachment",
                    })),
                  );
                  setLightboxIdx(idx);
                }}
                onRetryFailed={handleRetryMessage}
              />
            );
          })}

          {typingLabel ? (
            <div className="mt-2 flex items-center gap-1.5 px-1 text-xs text-text-muted">
              <span className="inline-flex gap-0.5" aria-hidden="true">
                <span className="size-1.5 animate-pulse rounded-full bg-text-muted" />
                <span className="size-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
              </span>
              <span>{typingLabel}</span>
            </div>
          ) : null}
        </div>

        {showJumpToLatest ? (
          <button
            type="button"
            onClick={() => {
              scrollToBottom("smooth");
              if (latestSeqRef.current > 0) {
                void markRealtimeConversationRead(conversationId, latestSeqRef.current);
              }
            }}
            className="absolute bottom-3 left-1/2 z-[5] flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text shadow-md hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
            <span>Latest{unseenIncomingCount > 0 ? ` (${unseenIncomingCount})` : ""}</span>
          </button>
        ) : null}
      </div>

      {/* Share picker overlay / bottom sheet */}
      {shareOpen ? (
        <LazyChatProductPicker
          open={shareOpen}
          viewerRole={viewerRole}
          isMobileSheet={isMobileViewport}
          formatPrice={formatPrice}
          onSelectShare={handleShareCard}
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      {/* Admin canned reply picker */}
      {cannedOpen && cannedReplies.length > 0 ? (
        <div className="max-h-52 space-y-1.5 overflow-y-auto border-t border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text">{ui.chat.thread.cannedTitle}</p>
            <button
              type="button"
              onClick={() => setCannedOpen(false)}
              aria-label={ui.chat.thread.cannedCloseAria}
              className="inline-flex size-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          {cannedReplies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => {
                setText((prev) => (prev ? `${prev}\n${reply.body}` : reply.body));
                setCannedOpen(false);
                requestAnimationFrame(() => autoResizeTextarea());
              }}
              className="block w-full rounded-xl border border-border p-2.5 text-left hover:bg-surface-2"
            >
              <p className="text-xs font-semibold text-text">{reply.title}</p>
              <p className="line-clamp-2 text-[11px] text-text-muted">{reply.body}</p>
            </button>
          ))}
        </div>
      ) : null}

      {/* 56px attachment preview strip above composer */}
      {queuedImages.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface-2/80 px-3 py-2">
          {queuedImages.map((img) => (
            <div
              key={img.localId}
              className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={ui.chat.thread.uploadPreviewAlt}
                className="size-full object-cover"
              />
              {img.status === "uploading" || img.status === "queued" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-footer-bg/70 text-[10px] font-semibold text-footer-text">
                  {img.progress}%
                </div>
              ) : null}
              {img.status === "error" ? (
                <button
                  type="button"
                  onClick={() => retryUploadItem(img.localId, img.file)}
                  aria-label={ui.chat.thread.retryUploadAria}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-danger/90 text-danger-foreground"
                >
                  <RefreshCw className="size-3.5" />
                  <span className="text-[9px] font-medium">{ui.chat.thread.retry}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => removeQueuedImage(img.localId)}
                aria-label={ui.chat.thread.removeImageAria}
                className="absolute top-0.5 right-0.5 inline-flex size-5 items-center justify-center rounded-full bg-footer-bg/85 text-footer-text"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Composer bar */}
      <div className="relative min-h-16 border-t border-border bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        {plusMenuOpen ? (
          <div className="mb-2 flex items-center gap-2 min-[360px]:hidden">
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                fileInputRef.current?.click();
              }}
              aria-label={ui.chat.attachAria}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-text hover:bg-surface-2"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              <span>{ui.chat.photo}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlusMenuOpen(false);
                void prefetchShareProducts(viewerRole === "CUSTOMER");
                setShareOpen(true);
                setCannedOpen(false);
              }}
              aria-label={ui.chat.shareAria}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-text hover:bg-surface-2"
            >
              <Paperclip className="size-4" aria-hidden="true" />
              <span>{ui.chat.sharePiece}</span>
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            aria-label={ui.chat.uploadAria}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => {
              void processFileQueue(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Compact + menu ONLY < 360px */}
          <button
            type="button"
            onClick={() => setPlusMenuOpen((o) => !o)}
            aria-label={ui.chat.moreActionsAria}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:hidden"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>

          {/* Direct 40x40 attach icon buttons on >= 360px */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={ui.chat.attachAria}
            className="hidden size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:inline-flex"
          >
            <ImagePlus className="size-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onPointerEnter={() => void prefetchShareProducts(viewerRole === "CUSTOMER")}
            onClick={() => {
              void prefetchShareProducts(viewerRole === "CUSTOMER");
              setShareOpen((o) => !o);
              setCannedOpen(false);
            }}
            aria-label={ui.chat.shareAria}
            className="hidden size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:inline-flex"
          >
            <Paperclip className="size-5" aria-hidden="true" />
          </button>

          {cannedReplies.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setCannedOpen((o) => !o);
                setShareOpen(false);
              }}
              aria-label={ui.chat.thread.cannedAria}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Sparkles className="size-5" aria-hidden="true" />
            </button>
          ) : null}

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoResizeTextarea();
              emitRealtimeTyping(conversationId, e.target.value.trim().length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={composerPlaceholder ?? ui.chat.composerPlaceholder}
            aria-label={ui.chat.thread.messageAria}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-[20px] border border-border-strong bg-surface px-3.5 py-2 text-[15px] leading-[1.35] text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            aria-label={ui.chat.sendAria}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
          >
            <ArrowUp className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      {lightboxIdx !== null ? (
        <LazyPrivateImageLightbox
          images={lightboxImages}
          activeIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onChangeIndex={setLightboxIdx}
        />
      ) : null}
    </div>
  );
}
