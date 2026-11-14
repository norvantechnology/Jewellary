"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminInboxRealtime } from "@/components/providers/useChatRealtime";
import { ChatThreadPanel } from "@/components/shared/ChatThreadPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAddConversationNoteAction,
  adminDeleteCannedReplyAction,
  adminUpdateConversationAction,
  adminUpsertCannedReplyAction,
} from "@/modules/chat/chat.actions";
import type {
  ChatCannedReplyDTO,
  ChatConversationDetailDTO,
  ChatConversationSummaryDTO,
} from "@/modules/chat/chat.service";

interface AdminMessagesClientProps {
  initialConversations: ChatConversationSummaryDTO[];
  initialTotalUnread: number;
  staffMembers: Array<{ id: string; name: string; role: string }>;
  initialCannedReplies: ChatCannedReplyDTO[];
  currentUserId: string;
  initialConversationId?: string | null;
}

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio playback blocked or unavailable
  }
}

export function AdminMessagesClient({
  initialConversations,
  initialTotalUnread,
  staffMembers,
  initialCannedReplies,
  currentUserId,
  initialConversationId,
}: AdminMessagesClientProps) {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [totalUnread, setTotalUnread] = React.useState(initialTotalUnread);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [mobileShowThread, setMobileShowThread] = React.useState(Boolean(initialConversationId));

  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "OPEN" | "RESOLVED" | "CLOSED">(
    "OPEN",
  );
  const [assignedFilter, setAssignedFilter] = React.useState("ALL");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const [threadDetail, setThreadDetail] = React.useState<ChatConversationDetailDTO | null>(null);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [newTag, setNewTag] = React.useState("");

  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );

  const [cannedReplies, setCannedReplies] = React.useState(initialCannedReplies);
  const [cannedModalOpen, setCannedModalOpen] = React.useState(false);
  const [cannedTitle, setCannedTitle] = React.useState("");
  const [cannedBody, setCannedBody] = React.useState("");
  const [savingCanned, setSavingCanned] = React.useState(false);

  const reloadInbox = React.useCallback(async () => {
    const params = new URLSearchParams({
      scope: "admin",
      status: statusFilter,
      assignedToId: assignedFilter,
      unreadOnly: String(unreadOnly),
      search: search.trim(),
      limit: "40",
    });
    const res = await fetch(`/api/chat/conversations?${params.toString()}`);
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { items: ChatConversationSummaryDTO[]; totalUnreadCount: number };
    } | null;
    if (res.ok && json?.data) {
      setConversations(json.data.items);
      setTotalUnread(json.data.totalUnreadCount);
    }
  }, [assignedFilter, search, statusFilter, unreadOnly]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      void reloadInbox();
    }, 180);
    return () => clearTimeout(handle);
  }, [reloadInbox]);

  useAdminInboxRealtime({
    enabled: true,
    onInboxEvent: (evt) => {
      if (evt.type === "chat:message") {
        const msg = evt.payload.message as
          { senderRole?: string; senderName?: string; body?: string } | undefined;
        if (msg?.senderRole === "CUSTOMER") {
          if (soundEnabled) playChime();
          if (
            typeof document !== "undefined" &&
            document.hidden &&
            notifPermission === "granted" &&
            "Notification" in window
          ) {
            new Notification(`New message from ${msg.senderName ?? "Collector"}`, {
              body: (msg.body ?? "").slice(0, 120) || "Sent an attachment",
            });
          }
        }
      }
      void reloadInbox();
    },
  });

  const selectedSummary =
    conversations.find((c) => c.id === selectedId) ?? threadDetail?.conversation ?? null;

  async function handleUpdateMeta(patch: {
    status?: "OPEN" | "RESOLVED" | "CLOSED";
    assignedToId?: string | null;
    tags?: string[];
  }) {
    if (!selectedId) return;
    const res = await adminUpdateConversationAction({
      conversationId: selectedId,
      ...patch,
    });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? res.data : c)));
    setThreadDetail((prev) => (prev ? { ...prev, conversation: res.data } : prev));
    toast.success("Conversation updated.");
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !noteBody.trim()) return;
    setSavingNote(true);
    const res = await adminAddConversationNoteAction({
      conversationId: selectedId,
      body: noteBody.trim(),
    });
    setSavingNote(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setNoteBody("");
    setThreadDetail((prev) =>
      prev ? { ...prev, notes: [res.data, ...(prev.notes ?? [])] } : prev,
    );
    toast.success("Private staff note added.");
  }

  async function handleCreateCanned(e: React.FormEvent) {
    e.preventDefault();
    if (!cannedTitle.trim() || !cannedBody.trim()) return;
    setSavingCanned(true);
    const res = await adminUpsertCannedReplyAction({
      title: cannedTitle.trim(),
      body: cannedBody.trim(),
      sortOrder: cannedReplies.length * 10,
      isActive: true,
    });
    setSavingCanned(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setCannedReplies((prev) => [...prev, res.data]);
    setCannedTitle("");
    setCannedBody("");
    toast.success("Canned reply template added.");
  }

  async function handleDeleteCanned(id: string) {
    const res = await adminDeleteCannedReplyAction({ id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setCannedReplies((prev) => prev.filter((r) => r.id !== id));
    toast.success("Template deleted.");
  }

  async function enableDesktopNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      toast.success("Desktop chat alerts enabled.");
    }
  }

  const activeCanned = React.useMemo(
    () => cannedReplies.filter((r) => r.isActive),
    [cannedReplies],
  );

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Messages
            </h1>
            {totalUnread > 0 ? <Badge>{totalUnread} unread</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live customer chats, shared products, custom requests and private notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
          >
            {soundEnabled ? (
              <Volume2 className="mr-1.5 size-4" />
            ) : (
              <VolumeX className="mr-1.5 size-4" />
            )}
            {soundEnabled ? "Sound On" : "Muted"}
          </Button>
          {typeof window !== "undefined" && "Notification" in window ? (
            <Button type="button" variant="outline" size="sm" onClick={enableDesktopNotifications}>
              {notifPermission === "granted" ? (
                <Bell className="mr-1.5 size-4 text-accent-text" />
              ) : (
                <BellOff className="mr-1.5 size-4" />
              )}
              {notifPermission === "granted" ? "Alerts Active" : "Enable Alerts"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCannedModalOpen(true)}
          >
            <Sparkles className="mr-1.5 size-4" />
            Templates ({cannedReplies.length})
          </Button>
        </div>
      </div>

      {/* Main Two-Pane Shell */}
      <div className="grid h-[calc(100dvh-13rem)] min-h-[540px] overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:grid-cols-12">
        {/* Conversation List Pane */}
        <div
          className={`flex min-h-0 flex-col border-r border-border lg:col-span-4 ${
            mobileShowThread ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="space-y-2.5 border-b border-border p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collector, email, message…"
                aria-label="Search conversations"
                className="pl-9 text-base sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NativeSelect
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | "OPEN" | "RESOLVED" | "CLOSED")
                }
                className="h-9 text-xs"
              >
                <option value="OPEN">Open Threads</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="ALL">All Statuses</option>
              </NativeSelect>

              <NativeSelect
                aria-label="Assignee filter"
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="ALL">Everyone</option>
                <option value="ME">Assigned to Me</option>
                <option value="UNASSIGNED">Unassigned</option>
                {staffMembers.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                Unread only
              </label>
              <span className="text-[11px] text-muted-foreground">
                {conversations.length} conversations
              </span>
            </div>
          </div>

          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="mb-2 size-7 opacity-50" />
                No conversations match these filters.
              </div>
            ) : (
              conversations.map((conv) => {
                const active = conv.id === selectedId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(conv.id);
                      setMobileShowThread(true);
                    }}
                    className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-muted/40 ${
                      active ? "bg-muted/70" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
                      {conv.customerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {conv.customerName}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {conv.lastMessageAt
                            ? new Date(conv.lastMessageAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {conv.lastMessagePreview ?? "New conversation"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {conv.contextType === "CUSTOMIZATION_REQUEST"
                            ? "Custom"
                            : conv.contextType}
                        </Badge>
                        {conv.unreadCount > 0 ? (
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Active Thread + Customer Context Pane */}
        <div
          className={`flex min-h-0 flex-col lg:col-span-8 ${
            mobileShowThread ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedId && selectedSummary ? (
            <>
              {/* Thread Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileShowThread(false)}
                    className="lg:hidden"
                    aria-label="Back to conversation list"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedSummary.customerName}
                      </p>
                      {selectedSummary.isGuest ? (
                        <Badge variant="outline" className="text-[10px]">
                          Guest
                        </Badge>
                      ) : null}
                    </div>
                    {selectedSummary.customerEmail ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedSummary.customerEmail}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <NativeSelect
                    aria-label="Assign staff"
                    value={selectedSummary.assignedToId ?? ""}
                    onChange={(e) =>
                      void handleUpdateMeta({
                        assignedToId: e.target.value || null,
                      })
                    }
                    className="h-9 w-auto text-xs"
                  >
                    <option value="">Unassigned</option>
                    {staffMembers.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.id === currentUserId ? `${st.name} (Me)` : st.name}
                      </option>
                    ))}
                  </NativeSelect>

                  <Button
                    type="button"
                    size="sm"
                    variant={selectedSummary.status === "OPEN" ? "outline" : "primary"}
                    onClick={() =>
                      void handleUpdateMeta({
                        status: selectedSummary.status === "RESOLVED" ? "OPEN" : "RESOLVED",
                      })
                    }
                  >
                    <CheckCircle2 className="mr-1 size-3.5" />
                    {selectedSummary.status === "RESOLVED" ? "Reopen" : "Resolve"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={contextOpen ? "primary" : "outline"}
                    onClick={() => setContextOpen((o) => !o)}
                  >
                    Context &amp; Notes
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="min-w-0 flex-1">
                  <ChatThreadPanel
                    conversationId={selectedId}
                    viewerRole="ADMIN"
                    cannedReplies={activeCanned}
                    onDetailLoaded={setThreadDetail}
                    onNewMessage={() => void reloadInbox()}
                  />
                </div>

                {/* Collapsible Context & Private Notes Sidebar */}
                {contextOpen ? (
                  <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border bg-muted/20 p-3.5 text-xs">
                    {selectedSummary.customizationRequestId ? (
                      <div className="rounded-lg border border-border bg-card p-3">
                        <p className="font-semibold text-foreground">Linked Customization</p>
                        <Link
                          href={`/admin/customizations/${selectedSummary.customizationRequestId}`}
                          className="mt-1 inline-flex items-center gap-1 text-accent-text hover:underline"
                        >
                          Open custom request
                          <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    ) : null}

                    {/* Tags */}
                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <p className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Tag className="size-3.5" />
                        Conversation Tags
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedSummary.tags.map((tag) => (
                          <Badge key={tag} variant="default" className="gap-1 text-[10px]">
                            {tag}
                            <button
                              type="button"
                              aria-label={`Remove tag ${tag}`}
                              onClick={() =>
                                void handleUpdateMeta({
                                  tags: selectedSummary.tags.filter((t) => t !== tag),
                                })
                              }
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newTag.trim()) return;
                          void handleUpdateMeta({
                            tags: [...selectedSummary.tags, newTag.trim()],
                          });
                          setNewTag("");
                        }}
                        className="flex gap-1"
                      >
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Add tag…"
                          className="h-8 text-base sm:text-xs"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
                          <Plus className="size-3.5" />
                        </Button>
                      </form>
                    </div>

                    {/* Customer Recent History */}
                    {threadDetail?.customerContext ? (
                      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <p className="font-semibold text-foreground">Recent Activity</p>
                        {threadDetail.customerContext.recentCustomizations.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase">
                              Customizations
                            </p>
                            {threadDetail.customerContext.recentCustomizations.map((c) => (
                              <Link
                                key={c.id}
                                href={`/admin/customizations/${c.id}`}
                                className="block rounded border border-border p-1.5 hover:bg-muted"
                              >
                                <p className="font-mono font-medium text-foreground">
                                  {c.requestNumber}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {c.productName} · {c.status}
                                </p>
                              </Link>
                            ))}
                          </div>
                        ) : null}

                        {threadDetail.customerContext.recentOrders.length > 0 ? (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
                            {threadDetail.customerContext.recentOrders.map((o) => (
                              <Link
                                key={o.id}
                                href={`/admin/orders/${o.id}`}
                                className="block rounded border border-border p-1.5 hover:bg-muted"
                              >
                                <p className="font-mono font-medium text-foreground">
                                  {o.orderNumber}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {o.status} · {o.currency} {o.total}
                                </p>
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Internal Private Notes */}
                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">Internal Staff Notes</p>
                      <p className="text-[11px] text-muted-foreground">
                        Strictly private — invisible to collector.
                      </p>
                      <form onSubmit={handleAddNote} className="space-y-1.5">
                        <Textarea
                          rows={2}
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
                          placeholder="Add private handoff note…"
                          className="text-base sm:text-xs"
                        />
                        <Button type="submit" size="sm" disabled={savingNote} className="w-full">
                          {savingNote ? "Saving…" : "Save Internal Note"}
                        </Button>
                      </form>

                      <div className="space-y-2 pt-1">
                        {(threadDetail?.notes ?? []).map((note) => (
                          <div
                            key={note.id}
                            className="rounded border border-border bg-muted/40 p-2"
                          >
                            <p className="text-[11px] font-medium text-foreground">
                              {note.authorName}
                            </p>
                            <p className="mt-0.5 text-xs whitespace-pre-wrap text-foreground">
                              {note.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="mb-3 size-10 opacity-40" />
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs">
                Choose a thread on the left to respond in real time or review customer context.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Canned Replies Manager Modal */}
      <Dialog open={cannedModalOpen} onOpenChange={setCannedModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick-reply templates</DialogTitle>
            <DialogDescription>
              Saved replies you can insert from the sparkles icon in any chat.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateCanned}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <Input
              value={cannedTitle}
              onChange={(e) => setCannedTitle(e.target.value)}
              placeholder="Template title (e.g. Ring Sizer Shipping)"
              required
            />
            <Textarea
              rows={3}
              value={cannedBody}
              onChange={(e) => setCannedBody(e.target.value)}
              placeholder="Write a reusable reply…"
              required
            />
            <Button type="submit" size="sm" disabled={savingCanned}>
              <Plus className="mr-1.5 size-3.5" />
              {savingCanned ? "Saving…" : "Add Template"}
            </Button>
          </form>

          <div className="space-y-2 pt-2">
            {cannedReplies.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{r.body}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDeleteCanned(r.id)}
                  aria-label="Delete canned reply"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCannedModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
