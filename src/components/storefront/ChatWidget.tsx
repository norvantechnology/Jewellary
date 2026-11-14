"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isTouchTextInputFocused, useModalHistory } from "@/hooks/use-modal-history";
import { MessageSquare } from "lucide-react";
import {
  ATELIER_CHAT_EVENT,
  ATELIER_DRAWER_STATE_EVENT,
  consumePendingAtelierChat,
  type OpenAtelierChatEventDetail,
} from "@/lib/atelier-events";
import { getCachedBootstrapSync, prefetchShareProducts } from "@/lib/chat-client-cache";

const loadChatWidgetPanel = () =>
  import("@/components/storefront/ChatWidgetPanel").then((mod) => mod.ChatWidgetPanel);

const LazyChatWidgetPanel = dynamic(loadChatWidgetPanel, {
  ssr: false,
  loading: function ChatPanelLoading() {
    const ui = useUiText();
    return (
      <div
        role="dialog"
        aria-label={ui.chat.launcherAria}
        aria-busy="true"
        className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex h-[100dvh] flex-col overflow-hidden bg-surface md:inset-x-auto md:right-6 md:bottom-6 md:h-[min(600px,calc(100dvh-112px))] md:w-[380px] md:rounded-2xl md:border md:border-border md:shadow-md"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-surface-2" />
            <div className="space-y-1">
              <div className="h-3.5 w-28 rounded bg-surface-2" />
              <div className="h-2.5 w-16 rounded bg-surface-2" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4" />
        <div className="h-14 border-t border-border p-3" />
      </div>
    );
  },
});

function prefetchPanelAndProducts() {
  void loadChatWidgetPanel();
  void import("@/components/providers/useChatRealtime").then((m) => m.ensureRealtimeSocket());
  void prefetchShareProducts(true);
}

/**
 * Tiny storefront chat launcher (stays in main bundle at ~2 KB gzipped).
 * The interactive chat panel + WebSocket client are code-split via next/dynamic
 * and prefetched only on idle, hover/focus/touchstart, or first open.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const [hasOpened, setHasOpened] = React.useState(false);
  const [chunkLoaded, setChunkLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [customizeDrawerOpen, setCustomizeDrawerOpen] = React.useState(false);
  const [pendingDetail, setPendingDetail] = React.useState<OpenAtelierChatEventDetail | null>(null);
  const [totalUnread, setTotalUnread] = React.useState<number>(() => {
    const boot = getCachedBootstrapSync();
    return boot?.totalUnread ?? 0;
  });

  const launcherRef = React.useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = React.useRef(false);

  // Restore focus cleanly to launcher when panel closes
  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      launcherRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  // Prefetch only the lightweight UI chunk on browser idle when data-saver is off;
  // avoid opening WebSockets or fetching product lists until launcher hover/focus/click.
  React.useEffect(() => {
    const conn =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        : undefined;
    if (conn?.saveData) return;

    const prefetchChunkOnly = () => {
      void loadChatWidgetPanel();
    };

    const idleId =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(prefetchChunkOnly, { timeout: 5000 })
        : setTimeout(prefetchChunkOnly, 4500);

    return () => {
      if (
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window &&
        typeof idleId === "number"
      ) {
        window.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  // Listen for custom open events & drawer open state
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const pending = consumePendingAtelierChat();
      if (pending) {
        setPendingDetail(pending);
        setHasOpened(true);
        setOpen(true);
      }
      if (document.documentElement.dataset.customizeDrawerOpen === "true") {
        setCustomizeDrawerOpen(true);
      }
    });

    const onOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<OpenAtelierChatEventDetail>).detail ?? {};
      setPendingDetail(detail);
      setHasOpened(true);
      setOpen(true);
    };

    const onDrawerState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setCustomizeDrawerOpen(Boolean(detail?.open));
    };

    window.addEventListener(ATELIER_CHAT_EVENT, onOpenEvent);
    window.addEventListener(ATELIER_DRAWER_STATE_EVENT, onDrawerState);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(ATELIER_CHAT_EVENT, onOpenEvent);
      window.removeEventListener(ATELIER_DRAWER_STATE_EVENT, onDrawerState);
    };
  }, []);

  // Unread badge while the panel is closed: refresh on load, on tab focus and every 20s
  // (works without the realtime socket, e.g. on Vercel). Skipped for visitors with no chats.
  React.useEffect(() => {
    if (open) return;
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat/conversations", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { totalUnread?: number } };
        if (!cancelled && typeof body.data?.totalUnread === "number") {
          setTotalUnread(body.data.totalUnread);
        }
      } catch {
        // Badge is best-effort.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [open]);

  // Phone Back closes the chat (and only hides the keyboard first if it is open).
  useModalHistory(open, () => setOpen(false));

  // Ensure Escape closes immediately even while the lazy panel chunk is still hydrating
  React.useEffect(() => {
    if (!open) return;
    void loadChatWidgetPanel().then(() => setChunkLoaded(true));
    const onEscapeWhileLoading = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTouchTextInputFocused()) return;
      if (document.querySelector('[role="dialog"][aria-busy="true"]')) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onEscapeWhileLoading);
    return () => window.removeEventListener("keydown", onEscapeWhileLoading);
  }, [open]);

  const isLeftAlignedRoute =
    Boolean(pathname?.includes("/customize")) || Boolean(pathname?.includes("/checkout"));
  const hideLauncher = open || customizeDrawerOpen;

  return (
    <>
      {!hideLauncher ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            setHasOpened(true);
            setOpen(true);
          }}
          onPointerEnter={prefetchPanelAndProducts}
          onFocus={prefetchPanelAndProducts}
          onTouchStart={prefetchPanelAndProducts}
          data-testid="atelier-chat-launcher"
          aria-label={`Open chat${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
          className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px)+var(--sticky-cta-offset,0px))] md:bottom-[calc(1.5rem+var(--sticky-cta-offset,0px))] ${
            isLeftAlignedRoute ? "left-4 md:left-6" : "right-4 md:right-6"
          } z-[var(--z-chat-launcher)] inline-flex size-[52px] items-center justify-center rounded-full border border-accent/40 bg-primary text-on-primary shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
        >
          <MessageSquare className="size-[22px]" strokeWidth={1.85} aria-hidden="true" />
          {totalUnread > 0 ? (
            <span className="absolute -top-1 -right-1 inline-flex size-[18px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-on-accent shadow-xs">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          ) : null}
        </button>
      ) : null}

      {hasOpened && (open || chunkLoaded) ? (
        <LazyChatWidgetPanel
          open={open}
          pendingOpenDetail={pendingDetail}
          onConsumePendingDetail={() => setPendingDetail(null)}
          onClose={() => setOpen(false)}
          onTotalUnreadChange={setTotalUnread}
        />
      ) : null}
    </>
  );
}
