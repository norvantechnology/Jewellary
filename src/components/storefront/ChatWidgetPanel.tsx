"use client";
import { isTouchTextInputFocused } from "@/hooks/use-modal-history";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ArrowUp, ChevronLeft, ImagePlus, Mail, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import {
  ensureRealtimeSocket,
  getRealtimeSocket,
  markRealtimeConversationRead,
  reconnectRealtimeSocket,
} from "@/components/providers/useChatRealtime";
import { ChatThreadPanel } from "@/components/shared/ChatThreadPanel";
import type { OpenAtelierChatEventDetail } from "@/lib/atelier-events";
import {
  fetchAndCacheChatBootstrap,
  getCachedBootstrapAsync,
  getCachedBootstrapSync,
  prefetchShareProducts,
  saveCachedBootstrap,
  type LocalClientChatMessage,
} from "@/lib/chat-client-cache";
import type {
  ChatBootstrapDTO,
  ChatConversationDetailDTO,
  ChatConversationSummaryDTO,
  ChatMessageDTO,
} from "@/modules/chat/chat.service";

const LazyStarterProductPicker = dynamic(
  () => import("@/components/shared/ChatProductPicker").then((mod) => mod.ChatProductPicker),
  { ssr: false },
);

function formatRelativeTime(iso: string | null, justNow: string): string {
  if (!iso) return "";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return justNow;
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface ChatWidgetPanelProps {
  open: boolean;
  pendingOpenDetail: OpenAtelierChatEventDetail | null;
  onConsumePendingDetail: () => void;
  onClose: () => void;
  onTotalUnreadChange: (totalUnread: number) => void;
}

export function ChatWidgetPanel({
  open,
  pendingOpenDetail,
  onConsumePendingDetail,
  onClose,
  onTotalUnreadChange,
}: ChatWidgetPanelProps) {
  const ui = useUiText();
  const pathname = usePathname();
  const { formatPrice } = useCurrency();
  const isLeftAlignedRoute =
    Boolean(pathname?.includes("/customize")) || Boolean(pathname?.includes("/checkout"));

  const syncBoot = React.useMemo(() => getCachedBootstrapSync(), []);

  const [session, setSession] = React.useState<ChatBootstrapDTO["session"] | null>(
    syncBoot?.session ?? null,
  );
  const [conversations, setConversations] = React.useState<ChatConversationSummaryDTO[]>(
    syncBoot?.conversations ?? [],
  );
  const [supportStatus, setSupportStatus] = React.useState<{
    isOnline: boolean;
    hoursLabel: string;
  }>(syncBoot?.supportStatus ?? { isOnline: true, hoursLabel: ui.chat.online });
  const [activeDetail, setActiveDetail] = React.useState<ChatConversationDetailDTO | null>(
    syncBoot?.activeDetail ?? null,
  );
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(() => {
    if (syncBoot?.activeDetail) return syncBoot.activeDetail.conversation.id;
    const active =
      syncBoot?.conversations.find((c) => c.status === "OPEN") ?? syncBoot?.conversations[0];
    return active?.id ?? null;
  });

  const [view, setView] = React.useState<"LIST" | "THREAD" | "NEW">(() => {
    if (syncBoot?.activeDetail || syncBoot?.conversations.length) return "THREAD";
    return "NEW";
  });

  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  const [vvStyle, setVvStyle] = React.useState<{ height: number; top: number } | null>(null);

  // Starter / New conversation state
  const [starterText, setStarterText] = React.useState("");
  const [starterPendingMsgs, setStarterPendingMsgs] = React.useState<LocalClientChatMessage[]>([]);
  const [starterPickerOpen, setStarterPickerOpen] = React.useState(false);
  const [starterPlusOpen, setStarterPlusOpen] = React.useState(false);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [defaultShareOpen, setDefaultShareOpen] = React.useState(false);

  // Post-first-message subtle inline guest email capture
  const [emailPromptDismissed, setEmailPromptDismissed] = React.useState(false);
  const [guestEmailInput, setGuestEmailInput] = React.useState("");
  const [guestEmailSaved, setGuestEmailSaved] = React.useState(false);
  const [savingGuestEmail, setSavingGuestEmail] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const starterFileRef = React.useRef<HTMLInputElement | null>(null);
  const starterTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const dragStartYRef = React.useRef<number | null>(null);
  const starterSeqRef = React.useRef(0);
  const [dragOffsetY, setDragOffsetY] = React.useState(0);
  const viewRef = React.useRef(view);
  const activeConversationIdRef = React.useRef(activeConversationId);
  const starterTextRef = React.useRef(starterText);
  const starterPendingMsgsRef = React.useRef(starterPendingMsgs);
  const userChoseNewRef = React.useRef(false);

  React.useEffect(() => {
    viewRef.current = view;
  }, [view]);
  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  React.useEffect(() => {
    starterTextRef.current = starterText;
  }, [starterText]);
  React.useEffect(() => {
    starterPendingMsgsRef.current = starterPendingMsgs;
  }, [starterPendingMsgs]);

  // Viewport + mobile keyboard visualViewport tracking
  React.useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileViewport(mobile);
      if (mobile && window.visualViewport) {
        setVvStyle({
          height: Math.round(window.visualViewport.height),
          top: Math.round(window.visualViewport.offsetTop),
        });
      } else {
        setVvStyle(null);
      }
    };
    check();
    window.addEventListener("resize", check);
    window.visualViewport?.addEventListener("resize", check);
    window.visualViewport?.addEventListener("scroll", check);
    return () => {
      window.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("scroll", check);
    };
  }, []);

  // Body scroll lock on mobile sheet while open
  React.useEffect(() => {
    if (!open || !isMobileViewport) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isMobileViewport]);

  // Apply fresh bootstrap data into panel state
  const applyBootstrap = React.useCallback(
    (boot: ChatBootstrapDTO) => {
      setSession(boot.session);
      setConversations(boot.conversations);
      setSupportStatus(boot.supportStatus);
      onTotalUnreadChange(boot.totalUnread);
      if (
        boot.activeDetail &&
        !userChoseNewRef.current &&
        starterTextRef.current.trim().length === 0
      ) {
        setActiveDetail(boot.activeDetail);
        setActiveConversationId((prev) => prev ?? boot.activeDetail!.conversation.id);
      }
    },
    [onTotalUnreadChange],
  );

  // Hydrate Async IndexedDB + SWR reconcile via single /api/chat/bootstrap on open
  React.useEffect(() => {
    if (!open) {
      userChoseNewRef.current = false;
      return;
    }
    let cancelled = false;

    void getCachedBootstrapAsync().then((idb) => {
      if (!cancelled && idb && !syncBoot) {
        applyBootstrap(idb);
      }
    });

    void fetchAndCacheChatBootstrap(activeConversationId).then((fresh) => {
      if (!cancelled && fresh) {
        applyBootstrap(fresh);
        if (
          !userChoseNewRef.current &&
          !activeConversationIdRef.current &&
          fresh.conversations.length > 0 &&
          viewRef.current === "NEW" &&
          starterTextRef.current.trim().length === 0 &&
          starterPendingMsgsRef.current.length === 0
        ) {
          const openConv =
            fresh.conversations.find((c) => c.status === "OPEN") ?? fresh.conversations[0];
          if (openConv) {
            activeConversationIdRef.current = openConv.id;
            viewRef.current = "THREAD";
            setActiveConversationId(openConv.id);
            setView("THREAD");
          }
        }
      }
    });

    // Lazily warm WebSocket + idle prefetch product picker
    void ensureRealtimeSocket();
    const idleTimer =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(() => void prefetchShareProducts(true), { timeout: 1200 })
        : setTimeout(() => void prefetchShareProducts(true), 600);

    return () => {
      cancelled = true;
      if (
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window &&
        typeof idleTimer === "number"
      ) {
        window.cancelIdleCallback(idleTimer);
      } else {
        clearTimeout(idleTimer as ReturnType<typeof setTimeout>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle contextual open requests (e.g. from Product / Order / Customization page)
  React.useEffect(() => {
    if (!open || !pendingOpenDetail) return;
    const detail = pendingOpenDetail;
    onConsumePendingDetail();

    const contextType = detail.contextType ?? "GENERAL";
    const contextRefId = detail.contextRefId ?? null;

    if (contextType !== "GENERAL" && contextRefId) {
      void (async () => {
        try {
          const res = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contextType, contextRefId }),
          });
          const json = (await res.json().catch(() => null)) as {
            ok?: boolean;
            data?: { conversation?: ChatConversationSummaryDTO };
          } | null;
          if (res.ok && json?.data?.conversation) {
            const conv = json.data.conversation;
            setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
            setActiveConversationId(conv.id);
            setDefaultShareOpen(Boolean(detail.openSharePicker));
            setView("THREAD");
          }
        } catch {
          toast.error(ui.chat.contextError);
        }
      })();
      return;
    }

    const raf = requestAnimationFrame(() => {
      if (detail.prefillMessage) {
        setStarterText(detail.prefillMessage);
      }
      if (detail.openSharePicker) {
        setDefaultShareOpen(true);
      }
      const existing = conversations.find((c) => c.status === "OPEN") ?? conversations[0];
      if (existing) {
        setActiveConversationId(existing.id);
        setView("THREAD");
      } else {
        setView("NEW");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, pendingOpenDetail, onConsumePendingDetail, conversations, ui]);

  // Lightweight socket listener for unread / conversation list previews (no refetch!)
  React.useEffect(() => {
    if (!open || !session?.authenticated) return;
    const socket = getRealtimeSocket();
    if (!socket) return;

    const handleInboxMessage = (evt: { conversationId?: string; message?: ChatMessageDTO }) => {
      const msg = evt.message;
      const cid = evt.conversationId;
      if (!msg || !cid) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === cid);
        if (idx === -1) return prev;
        const target = prev[idx]!;
        const isIncoming = msg.senderRole !== "CUSTOMER";
        const isCurrentlyViewing = open && view === "THREAD" && activeConversationId === cid;
        const nextUnread =
          isIncoming && !isCurrentlyViewing ? target.unreadCount + 1 : target.unreadCount;

        const updatedConv: ChatConversationSummaryDTO = {
          ...target,
          lastMessageAt: msg.createdAt,
          lastMessageSeq: msg.seq,
          lastMessagePreview: msg.body.slice(0, 140),
          unreadCount: nextUnread,
        };
        const rest = prev.filter((c) => c.id !== cid);
        const nextList = [updatedConv, ...rest];
        const total = nextList.reduce((acc, c) => acc + c.unreadCount, 0);
        onTotalUnreadChange(total);
        return nextList;
      });
    };

    socket.on("chat:message", handleInboxMessage);
    return () => {
      socket.off("chat:message", handleInboxMessage);
    };
  }, [open, session?.authenticated, view, activeConversationId, onTotalUnreadChange]);

  // Escape & Focus trap inside open panel
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Android keyboards can send Escape when dismissed: only hide the keyboard then.
        if (isTouchTextInputFocused()) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (starterPickerOpen) {
          setStarterPickerOpen(false);
          return;
        }
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const raf = requestAnimationFrame(() => {
      // On phones don't focus the text box (it would pop the keyboard over the panel).
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const target = panelRef.current?.querySelector<HTMLElement>(
        touch
          ? "button:not([disabled])"
          : "textarea:not([disabled]), input:not([disabled]), button:not([disabled])",
      );
      target?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, view, starterPickerOpen, onClose]);

  async function handleStartConversation(initialMessageText: string, files?: File[]) {
    const trimmed = initialMessageText.trim();
    if (!trimmed && (!files || files.length === 0)) return;

    const nowIso = new Date().toISOString();
    starterSeqRef.current += 1;
    const optimisticTempId = `starter_${starterSeqRef.current}`;
    if (trimmed) {
      setStarterText("");
      if (starterTextareaRef.current) starterTextareaRef.current.style.height = "auto";
      setStarterPendingMsgs([
        {
          id: optimisticTempId,
          seq: 0,
          conversationId: "pending",
          senderId: null,
          senderRole: "CUSTOMER",
          senderName: ui.chat.you,
          type: "TEXT",
          body: trimmed,
          attachments: [],
          refId: null,
          refSnapshot: null,
          clientTempId: optimisticTempId,
          deliveredAt: null,
          readAt: null,
          createdAt: nowIso,
          localStatus: "sending",
        },
      ]);
    }

    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contextType: "GENERAL",
          initialMessage: trimmed || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { conversation?: ChatConversationSummaryDTO };
        error?: unknown;
      } | null;
      if (!res.ok || !json?.data?.conversation) {
        throw new Error(extractApiErrorMessage(json, ui.chat.startError));
      }

      const conv = json.data.conversation;
      userChoseNewRef.current = false;
      activeConversationIdRef.current = conv.id;
      viewRef.current = "THREAD";
      setStarterPendingMsgs([]);
      if (files && files.length > 0) {
        setPendingFiles(files);
      }
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      setActiveConversationId(conv.id);
      setView("THREAD");

      if (syncBoot) {
        saveCachedBootstrap({
          ...syncBoot,
          conversations: [conv, ...conversations.filter((c) => c.id !== conv.id)],
        });
      }
      if (!session?.authenticated) {
        reconnectRealtimeSocket();
      }
      void ensureRealtimeSocket();
    } catch (err) {
      setStarterPendingMsgs([]);
      if (trimmed) {
        starterTextRef.current = trimmed;
        setStarterText(trimmed);
      }
      toast.error(err instanceof Error ? err.message : ui.chat.startFailed);
    }
  }

  async function handleStarterShareCard(
    type: "PRODUCT" | "REQUEST" | "ORDER",
    refId: string,
    label: string,
  ) {
    setStarterPickerOpen(false);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contextType: "GENERAL" }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { conversation?: ChatConversationSummaryDTO };
        error?: unknown;
      } | null;
      if (!res.ok || !json?.data?.conversation) {
        throw new Error(extractApiErrorMessage(json, ui.chat.startError));
      }
      const conv = json.data.conversation;
      userChoseNewRef.current = false;
      activeConversationIdRef.current = conv.id;
      viewRef.current = "THREAD";
      if (!session?.authenticated) {
        reconnectRealtimeSocket();
      }
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      setActiveConversationId(conv.id);
      setView("THREAD");

      await fetch(`/api/chat/conversations/${encodeURIComponent(conv.id)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          body: label,
          refId,
          clientTempId: `card_${Date.now()}`,
        }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ui.chat.shareError);
    }
  }

  async function handleSaveGuestEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = guestEmailInput.trim();
    if (!trimmed) return;
    setSavingGuestEmail(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contextType: "GENERAL",
          guestEmail: trimmed,
        }),
      });
      if (!res.ok) throw new Error(ui.chat.emailSaveError);
      setGuestEmailSaved(true);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, customerEmail: trimmed } : c)),
      );
      toast.success(ui.chat.emailSaved);
    } catch {
      toast.error(ui.chat.emailInvalid);
    } finally {
      setSavingGuestEmail(false);
    }
  }

  if (!open) return null;

  const activeConv = conversations.find((c) => c.id === activeConversationId) ?? null;
  const shouldShowBack =
    (view === "THREAD" && conversations.length > 1) || (view === "NEW" && conversations.length > 0);

  const needsPostMessageEmailPrompt =
    view === "THREAD" &&
    Boolean(activeConversationId) &&
    !session?.userId &&
    !activeConv?.customerEmail &&
    !guestEmailSaved &&
    !emailPromptDismissed &&
    Boolean(activeConv?.lastMessageSeq && activeConv.lastMessageSeq > 0);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label={ui.chat.panelAria}
      aria-modal={isMobileViewport ? true : undefined}
      style={
        isMobileViewport
          ? {
              height: vvStyle ? `${vvStyle.height}px` : "100dvh",
              top: vvStyle ? `${vvStyle.top}px` : "0px",
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
            }
          : undefined
      }
      className={
        isMobileViewport
          ? "fixed inset-x-0 z-[var(--z-modal)] flex flex-col overflow-hidden bg-surface"
          : `fixed bottom-6 ${
              isLeftAlignedRoute ? "left-6" : "right-6"
            } z-[var(--z-modal)] flex h-[min(600px,calc(100dvh-112px))] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-md`
      }
    >
      {/* Single 56px aligned header */}
      <header
        onTouchStart={(e) => {
          if (!isMobileViewport) return;
          dragStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          if (!isMobileViewport || dragStartYRef.current === null) return;
          const delta = (e.touches[0]?.clientY ?? 0) - dragStartYRef.current;
          if (delta > 0) setDragOffsetY(delta);
        }}
        onTouchEnd={() => {
          if (!isMobileViewport) return;
          if (dragOffsetY > 72) {
            setDragOffsetY(0);
            dragStartYRef.current = null;
            onClose();
            return;
          }
          setDragOffsetY(0);
          dragStartYRef.current = null;
        }}
        className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface pr-2 pl-3"
      >
        {shouldShowBack ? (
          <button
            type="button"
            onClick={() => setView("LIST")}
            aria-label={ui.chat.viewAllAria}
            className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors after:absolute after:-inset-0.5 hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text"
            aria-hidden="true"
          >
            <Sparkles className="size-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-semibold text-text">
            {ui.chat.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs leading-tight text-text-muted">
            <span
              className={`size-2 shrink-0 rounded-full ${
                supportStatus.isOnline ? "bg-success" : "bg-text-muted/60"
              }`}
              aria-hidden="true"
            />
            <span className="truncate">
              {supportStatus.isOnline ? ui.chat.online : ui.chat.offline}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {view !== "NEW" ? (
            <button
              type="button"
              onClick={() => {
                userChoseNewRef.current = true;
                activeConversationIdRef.current = null;
                viewRef.current = "NEW";
                setActiveConversationId(null);
                setView("NEW");
              }}
              aria-label={ui.chat.newConversation}
              title={ui.chat.newConversation}
              className="relative inline-flex size-10 items-center justify-center rounded-full text-text-muted transition-colors after:absolute after:-inset-0.5 hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-4.5" aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            aria-label={ui.chat.closeAria}
            className="relative inline-flex size-10 items-center justify-center rounded-full text-text-muted transition-colors after:absolute after:-inset-0.5 hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === "LIST" ? (
          <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {conversations.length === 0 ? (
              <p className="py-12 text-center text-sm text-text-muted">{ui.chat.noConversations}</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    userChoseNewRef.current = false;
                    activeConversationIdRef.current = conv.id;
                    viewRef.current = "THREAD";
                    setActiveConversationId(conv.id);
                    setView("THREAD");
                    if (conv.unreadCount > 0) {
                      setConversations((prev) =>
                        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
                      );
                      void markRealtimeConversationRead(conv.id);
                    }
                  }}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-text">
                        {conv.contextType === "GENERAL"
                          ? ui.chat.title
                          : conv.contextType.replace("_", " ")}
                      </span>
                      {conv.lastMessageAt ? (
                        <span className="shrink-0 text-[11px] text-text-muted">
                          {formatRelativeTime(conv.lastMessageAt, ui.chat.justNow)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-text-muted">
                      {conv.lastMessagePreview || ui.chat.conversationOpened}
                    </p>
                  </div>
                  {conv.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent">
                      {conv.unreadCount}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : view === "THREAD" && activeConversationId ? (
          <>
            <ChatThreadPanel
              conversationId={activeConversationId}
              viewerRole="CUSTOMER"
              initialDetail={
                activeDetail?.conversation.id === activeConversationId ? activeDetail : null
              }
              suggestedPrompts={ui.chat.quickTopics}
              composerPlaceholder={ui.chat.composerPlaceholder}
              defaultShareOpen={defaultShareOpen}
              initialFiles={pendingFiles}
              isMobileViewport={isMobileViewport}
              onConsumeInitialFiles={() => {
                setPendingFiles([]);
                setDefaultShareOpen(false);
              }}
              onDetailLoaded={(d) => {
                setSupportStatus(d.supportStatus);
                setActiveDetail(d);
                setConversations((prev) =>
                  prev.map((c) => (c.id === d.conversation.id ? d.conversation : c)),
                );
              }}
              onNewMessage={(msg) => {
                setConversations((prev) => {
                  const next = prev.map((c) =>
                    c.id === msg.conversationId
                      ? {
                          ...c,
                          lastMessageAt: msg.createdAt,
                          lastMessageSeq: Math.max(c.lastMessageSeq ?? 0, msg.seq),
                          lastMessagePreview: msg.body.slice(0, 140),
                        }
                      : c,
                  );
                  return next;
                });
              }}
            />
            {needsPostMessageEmailPrompt ? (
              <form
                onSubmit={(e) => void handleSaveGuestEmail(e)}
                className="flex items-center gap-2 border-t border-border bg-surface-2/85 px-3 py-2 text-xs"
              >
                <Mail className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <input
                  type="email"
                  required
                  value={guestEmailInput}
                  onChange={(e) => setGuestEmailInput(e.target.value)}
                  placeholder={ui.chat.emailPlaceholder}
                  aria-label={ui.chat.emailAria}
                  className="h-8 min-w-0 flex-1 rounded-full border border-border bg-surface px-3 text-xs text-text placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingGuestEmail}
                  className="inline-flex h-8 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-medium text-on-primary"
                >
                  {ui.chat.saveEmail}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailPromptDismissed(true)}
                  aria-label={ui.chat.dismissEmailAria}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </form>
            ) : null}
          </>
        ) : (
          /* Centered Empty State + Starter Composer (no initial email form!) */
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 text-center">
              {starterPendingMsgs.length > 0 ? (
                <div className="w-full space-y-2">
                  {starterPendingMsgs.map((m) => (
                    <div key={m.id} className="flex flex-col items-end">
                      <div className="max-w-[82%] rounded-2xl rounded-br-[4px] bg-primary px-3.5 py-2.5 text-left text-[15px] leading-[1.45] text-on-primary">
                        {m.body}
                      </div>
                      <span className="mt-1 text-[11px] text-text-muted">{ui.chat.sending}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-border bg-surface-2 text-accent-text">
                    <Sparkles className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-semibold text-text">{ui.chat.emptyTitle}</h2>
                  <p className="mt-1 max-w-[260px] text-[13px] text-text-muted">
                    {ui.chat.emptyText}
                  </p>
                  <div className="mt-4 flex w-full max-w-[300px] flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
                    {ui.chat.quickTopics.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleStartConversation(prompt)}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-auto"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {starterPickerOpen ? (
              <LazyStarterProductPicker
                open={starterPickerOpen}
                viewerRole="CUSTOMER"
                isMobileSheet={isMobileViewport}
                formatPrice={formatPrice}
                onSelectShare={handleStarterShareCard}
                onClose={() => setStarterPickerOpen(false)}
              />
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleStartConversation(starterText);
              }}
              className="min-h-16 shrink-0 border-t border-border bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
            >
              {starterPlusOpen ? (
                <div className="mb-2 flex items-center gap-2 min-[360px]:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setStarterPlusOpen(false);
                      starterFileRef.current?.click();
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
                      setStarterPlusOpen(false);
                      void prefetchShareProducts(true);
                      setStarterPickerOpen(true);
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
                  ref={starterFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  aria-label={ui.chat.uploadAria}
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files ? Array.from(e.target.files) : [];
                    e.target.value = "";
                    if (picked.length > 0) {
                      void handleStartConversation(starterText || ui.chat.sharedImage, picked);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setStarterPlusOpen((o) => !o)}
                  aria-label={ui.chat.moreActionsAria}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:hidden"
                >
                  <Plus className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => starterFileRef.current?.click()}
                  aria-label={ui.chat.attachAria}
                  className="hidden size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:inline-flex"
                >
                  <ImagePlus className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onPointerEnter={() => void prefetchShareProducts(true)}
                  onClick={() => {
                    void prefetchShareProducts(true);
                    setStarterPickerOpen((o) => !o);
                  }}
                  aria-label={ui.chat.shareAria}
                  className="hidden size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-[360px]:inline-flex"
                >
                  <Paperclip className="size-5" aria-hidden="true" />
                </button>
                <textarea
                  ref={starterTextareaRef}
                  rows={1}
                  value={starterText}
                  onChange={(e) => {
                    starterTextRef.current = e.target.value;
                    setStarterText(e.target.value);
                    const ta = e.target;
                    ta.style.height = "auto";
                    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleStartConversation(starterText);
                    }
                  }}
                  placeholder={ui.chat.composerPlaceholder}
                  aria-label={ui.chat.messageAria}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-[20px] border border-border-strong bg-surface px-3.5 py-2 text-[15px] leading-[1.35] text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                <button
                  type="submit"
                  aria-label={ui.chat.sendAria}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
                >
                  <ArrowUp className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
