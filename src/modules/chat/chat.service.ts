import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { env } from "@/lib/env";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { writeAuditLog } from "@/server/audit";
import { cacheDeleteKey, cacheGetJson, cacheSetJson, measureChatOp } from "@/server/chat-cache";
import { assertCustomerOrGuestOwnership, type ActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { sendChatOfflineReplyEmail } from "@/server/email/customization-send";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";
import {
  createSignedPrivateMediaUrl,
  deletePrivateMediaObject,
  isStorageKeyOwnedByActor,
} from "@/server/private-media";
import { enforceRateLimit } from "@/server/rate-limit";
import { publishRealtimeEvent } from "@/server/realtime/realtime-bus";
import type {
  adminAddNoteSchema,
  adminCannedReplySchema,
  adminListConversationsSchema,
  adminUpdateConversationSchema,
  markReadSchema,
  sendMessageSchema,
  startConversationSchema,
} from "./chat.schemas";
import type { z } from "zod";

export interface ChatAttachmentDTO {
  storageKey: string;
  thumbKey?: string;
  url: string;
  thumbUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalName?: string;
  expiresAt: string;
}

export interface ChatRefSnapshotProduct {
  kind: "PRODUCT";
  id?: string;
  productId: string;
  slug: string;
  sku?: string;
  name: string;
  category: string;
  imageUrl: string | null;
  thumbUrl?: string | null;
  basePrice: string;
  price?: string;
  priceMode: string;
  currency: "USD";
  inStock?: boolean;
}

export interface ChatRefSnapshotRequest {
  kind: "REQUEST";
  requestId: string;
  requestNumber: string;
  productName: string;
  productSlug: string;
  status: string;
  quotedPriceBase: string | null;
}

export interface ChatRefSnapshotOrder {
  kind: "ORDER";
  orderId: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  itemCount: number;
}

export type ChatRefSnapshot =
  ChatRefSnapshotProduct | ChatRefSnapshotRequest | ChatRefSnapshotOrder;

export interface ChatMessageDTO {
  id: string;
  seq: number;
  conversationId: string;
  senderId: string | null;
  senderRole: "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM";
  senderName: string;
  type: "TEXT" | "IMAGE" | "PRODUCT" | "REQUEST" | "ORDER" | "SYSTEM";
  body: string;
  attachments: ChatAttachmentDTO[];
  refId: string | null;
  refSnapshot: ChatRefSnapshot | null;
  clientTempId: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ChatConversationSummaryDTO {
  id: string;
  contextType: "GENERAL" | "PRODUCT" | "CUSTOMIZATION_REQUEST" | "ORDER";
  contextRefId: string | null;
  customizationRequestId: string | null;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  tags: string[];
  assignedToId: string | null;
  assignedToName: string | null;
  customerName: string;
  customerEmail: string | null;
  isGuest: boolean;
  lastMessageAt: string | null;
  lastMessageSeq?: number;
  lastMessagePreview: string | null;
  unreadCount: number;
  customerLastReadSeq: number;
  adminLastReadSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessagesPageDTO {
  messages: ChatMessageDTO[];
  hasMoreOlder: boolean;
  nextCursor: string | null;
  oldestSeq: number | null;
  newestSeq: number;
  lastReadSeq: number;
  etag: string;
}

export interface ChatBootstrapDTO {
  session: {
    authenticated: boolean;
    userId: string | null;
    userName: string;
    userEmail: string | null;
    role: string | null;
    isStaff: boolean;
    guestToken: string | null;
    targetKeys: string[];
  };
  conversations: ChatConversationSummaryDTO[];
  totalUnread: number;
  activeDetail: ChatConversationDetailDTO | null;
  supportStatus: {
    isOnline: boolean;
    hoursLabel: string;
  };
  limits: {
    maxAttachments: number;
    maxBytes: number;
    acceptedMimeTypes: string[];
  };
}

export interface ChatNoteDTO {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChatCannedReplyDTO {
  id: string;
  title: string;
  category: string | null;
  body: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ChatCustomerContextDTO {
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    currency: string;
    createdAt: string;
  }>;
  recentCustomizations: Array<{
    id: string;
    requestNumber: string;
    productName: string;
    status: string;
    quotedPriceBase: string | null;
    createdAt: string;
  }>;
}

export interface ChatConversationDetailDTO {
  conversation: ChatConversationSummaryDTO;
  messages: ChatMessageDTO[];
  hasMoreOlder: boolean;
  oldestSeq: number | null;
  newestSeq: number;
  supportStatus: {
    isOnline: boolean;
    hoursLabel: string;
  };
  notes?: ChatNoteDTO[];
  customerContext?: ChatCustomerContextDTO;
}

interface StoredAttachmentMeta {
  storageKey: string;
  thumbKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  originalName?: string;
}

export function sanitizeChatText(raw: string | null | undefined, maxLen = 2000): string {
  if (!raw) return "";
  return raw
    .replace(/\u0000/g, "")
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}

export function isAtelierSupportOnline(supportHours: string | null): {
  isOnline: boolean;
  hoursLabel: string;
} {
  const hoursLabel = supportHours?.trim() || "Mon–Sat, 9 am–7 pm UTC";
  // Parse simple HH:MM-HH:MM time window when present; otherwise assume online during business hours Mon-Sat
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const match = hoursLabel.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return { isOnline: day !== 0, hoursLabel };
  }
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isBusinessDay = hoursLabel.toLowerCase().includes("sun") ? true : day !== 0;
  const withinWindow =
    endMinutes >= startMinutes
      ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
      : nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  return {
    isOnline: isBusinessDay && withinWindow,
    hoursLabel,
  };
}

function signChatAttachmentUrls(
  conversationId: string,
  rawAttachments: unknown,
): ChatAttachmentDTO[] {
  if (!Array.isArray(rawAttachments)) return [];
  const results: ChatAttachmentDTO[] = [];

  for (const item of rawAttachments) {
    if (!item || typeof item !== "object") continue;
    const meta = item as Partial<StoredAttachmentMeta>;
    if (!meta.storageKey || typeof meta.storageKey !== "string") continue;

    const thumbKey =
      typeof meta.thumbKey === "string" && meta.thumbKey.length > 0
        ? meta.thumbKey
        : meta.storageKey.replace(/\.webp$/, "-thumb.webp");

    const signedFull = createSignedPrivateMediaUrl({
      kind: "chat",
      recordId: conversationId,
      storageKey: meta.storageKey,
      thumb: false,
    });
    const signedThumb = createSignedPrivateMediaUrl({
      kind: "chat",
      recordId: conversationId,
      storageKey: thumbKey,
      thumb: true,
    });

    results.push({
      storageKey: meta.storageKey,
      thumbKey,
      url: signedFull.url,
      thumbUrl: signedThumb.url,
      mimeType: meta.mimeType ?? "image/webp",
      sizeBytes: typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0,
      width: typeof meta.width === "number" ? meta.width : undefined,
      height: typeof meta.height === "number" ? meta.height : undefined,
      originalName: typeof meta.originalName === "string" ? meta.originalName : undefined,
      expiresAt: signedFull.expiresAt.toISOString(),
    });
  }
  return results;
}

function buildCustomerTargetKeys(conv: {
  userId: string | null;
  guestToken: string | null;
}): string[] {
  const keys: string[] = [];
  if (conv.userId) keys.push(`user:${conv.userId}`);
  if (conv.guestToken) keys.push(`guest:${conv.guestToken}`);
  return keys;
}

function formatMessageRow(row: {
  id: string;
  seq: number;
  conversationId: string;
  senderId: string | null;
  senderRole: "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM";
  senderName: string;
  type: "TEXT" | "IMAGE" | "PRODUCT" | "REQUEST" | "ORDER" | "SYSTEM";
  body: string;
  attachments: Prisma.JsonValue | null;
  refId: string | null;
  refSnapshot: Prisma.JsonValue | null;
  clientTempId: string | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}): ChatMessageDTO {
  return {
    id: row.id,
    seq: row.seq,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderRole: row.senderRole,
    senderName: row.senderName,
    type: row.type,
    body: row.body,
    attachments: signChatAttachmentUrls(row.conversationId, row.attachments),
    refId: row.refId,
    refSnapshot: (row.refSnapshot as ChatRefSnapshot | null) ?? null,
    clientTempId: row.clientTempId,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildConversationSubjectLabel(conv: {
  contextType: string;
  contextRefId: string | null;
}): string {
  switch (conv.contextType) {
    case "CUSTOMIZATION_REQUEST":
      return "Custom design help";
    case "PRODUCT":
      return "Product Inquiry";
    case "ORDER":
      return "Order help";
    default:
      return "Customer Care";
  }
}

function formatConversationSummary(
  row: {
    id: string;
    contextType: "GENERAL" | "PRODUCT" | "CUSTOMIZATION_REQUEST" | "ORDER";
    contextRefId: string | null;
    customizationRequestId: string | null;
    userId: string | null;
    guestToken: string | null;
    guestName: string | null;
    guestEmail: string | null;
    status: "OPEN" | "RESOLVED" | "CLOSED";
    tags: string[];
    assignedToId: string | null;
    lastMessageAt: Date | null;
    lastMessageSeq?: number;
    lastMessagePreview: string | null;
    customerUnreadCount?: number;
    adminUnreadCount?: number;
    createdAt: Date;
    updatedAt: Date;
    user?: { name: string; email: string } | null;
    assignedTo?: { name: string } | null;
    participants?: Array<{ role: "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM"; lastReadSeq: number }>;
  },
  unreadCount: number,
): ChatConversationSummaryDTO {
  let customerLastReadSeq = 0;
  let adminLastReadSeq = 0;
  for (const p of row.participants ?? []) {
    if (p.role === "CUSTOMER") {
      customerLastReadSeq = Math.max(customerLastReadSeq, p.lastReadSeq);
    } else if (p.role === "ADMIN" || p.role === "STAFF") {
      adminLastReadSeq = Math.max(adminLastReadSeq, p.lastReadSeq);
    }
  }

  return {
    id: row.id,
    contextType: row.contextType,
    contextRefId: row.contextRefId,
    customizationRequestId: row.customizationRequestId,
    status: row.status,
    tags: row.tags,
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo?.name ?? null,
    customerName: row.user?.name ?? row.guestName ?? "Guest Collector",
    customerEmail: row.user?.email ?? row.guestEmail ?? null,
    isGuest: !row.userId,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    lastMessageSeq: row.lastMessageSeq ?? 0,
    lastMessagePreview: row.lastMessagePreview,
    unreadCount,
    customerLastReadSeq,
    adminLastReadSeq,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveReferenceSnapshot(
  type: "PRODUCT" | "REQUEST" | "ORDER",
  refId: string,
  actor: ActorIdentity,
): Promise<{ canonicalRefId: string; snapshot: ChatRefSnapshot; previewLabel: string }> {
  if (type === "PRODUCT") {
    const product = await db.product.findFirst({
      where: {
        OR: [{ id: refId }, { slug: refId }],
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });
    if (!product) {
      throw new NotFoundError("Referenced product is unavailable.");
    }
    const snapshot: ChatRefSnapshotProduct = {
      kind: "PRODUCT",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category.name,
      imageUrl: product.images[0]?.thumbUrl ?? product.images[0]?.url ?? null,
      basePrice: product.basePrice.toFixed(2),
      priceMode: product.priceMode,
      currency: "USD",
    };
    return {
      canonicalRefId: product.id,
      snapshot,
      previewLabel: `Shared piece: ${product.name}`,
    };
  }

  if (type === "REQUEST") {
    const reqRow = await db.customizationRequest.findFirst({
      where: { OR: [{ id: refId }, { requestNumber: refId }] },
      include: { product: { select: { name: true, slug: true } } },
    });
    if (!reqRow) {
      throw new NotFoundError("Referenced customization request was not found.");
    }
    assertCustomerOrGuestOwnership(actor, reqRow, "chat:manage");
    const snapshot: ChatRefSnapshotRequest = {
      kind: "REQUEST",
      requestId: reqRow.id,
      requestNumber: reqRow.requestNumber,
      productName: reqRow.product.name,
      productSlug: reqRow.product.slug,
      status: reqRow.status,
      quotedPriceBase: reqRow.quotedPriceBase ? reqRow.quotedPriceBase.toFixed(2) : null,
    };
    return {
      canonicalRefId: reqRow.id,
      snapshot,
      previewLabel: `Shared custom request ${reqRow.requestNumber}`,
    };
  }

  const order = await db.order.findFirst({
    where: { OR: [{ id: refId }, { orderNumber: refId }] },
    include: { _count: { select: { items: true } } },
  });
  if (!order) {
    throw new NotFoundError("Referenced order was not found.");
  }
  const canManage = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
  const ownsByUser = Boolean(actor.userId && order.userId === actor.userId);
  const ownsByEmail = Boolean(
    actor.userEmail &&
    order.guestEmail &&
    actor.userEmail.toLowerCase() === order.guestEmail.toLowerCase(),
  );
  if (!canManage && !ownsByUser && !ownsByEmail) {
    throw new ForbiddenError("You do not have permission to share this order.");
  }

  const snapshot: ChatRefSnapshotOrder = {
    kind: "ORDER",
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total.toFixed(2),
    currency: order.currency,
    itemCount: order._count.items,
  };
  return {
    canonicalRefId: order.id,
    snapshot,
    previewLabel: `Shared order ${order.orderNumber}`,
  };
}

export async function getOrCreateConversation(
  input: z.infer<typeof startConversationSchema>,
  actor: ActorIdentity,
): Promise<ChatConversationSummaryDTO> {
  if (!actor.userId && !actor.guestToken) {
    throw new ValidationError("Unable to initialize chat session without visitor identity.");
  }

  let normalizedRefId = input.contextRefId?.trim() || null;
  let customizationRequestId: string | null = null;
  let initialTag: string | null = null;

  if (input.contextType === "PRODUCT" && normalizedRefId) {
    const prod = await db.product.findFirst({
      where: { OR: [{ id: normalizedRefId }, { slug: normalizedRefId }], deletedAt: null },
      select: { id: true },
    });
    if (!prod) throw new NotFoundError("Product not found for chat context.");
    normalizedRefId = prod.id;
    initialTag = "Product Inquiry";
  } else if (input.contextType === "CUSTOMIZATION_REQUEST" && normalizedRefId) {
    const reqRow = await db.customizationRequest.findFirst({
      where: { OR: [{ id: normalizedRefId }, { requestNumber: normalizedRefId }] },
      select: { id: true, userId: true, guestToken: true },
    });
    if (!reqRow) throw new NotFoundError("Customization request not found.");
    assertCustomerOrGuestOwnership(actor, reqRow, "chat:manage");
    normalizedRefId = reqRow.id;
    customizationRequestId = reqRow.id;
    initialTag = "Customization";
  } else if (input.contextType === "ORDER" && normalizedRefId) {
    const order = await db.order.findFirst({
      where: { OR: [{ id: normalizedRefId }, { orderNumber: normalizedRefId }] },
      select: { id: true, userId: true, guestEmail: true },
    });
    if (!order) throw new NotFoundError("Order not found.");
    const canManage = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
    const owns =
      (actor.userId && order.userId === actor.userId) ||
      (actor.userEmail &&
        order.guestEmail &&
        actor.userEmail.toLowerCase() === order.guestEmail.toLowerCase());
    if (!canManage && !owns) {
      throw new ForbiddenError("You do not have permission to start chat for this order.");
    }
    normalizedRefId = order.id;
    initialTag = "Order Support";
  }

  const ownershipFilter: Prisma.ConversationWhereInput = actor.userId
    ? actor.guestToken
      ? { OR: [{ userId: actor.userId }, { guestToken: actor.guestToken }] }
      : { userId: actor.userId }
    : { guestToken: actor.guestToken! };

  // Reuse existing contextual conversation (or open GENERAL conversation)
  const existing = await db.conversation.findFirst({
    where: {
      AND: [
        ownershipFilter,
        {
          contextType: input.contextType,
          ...(normalizedRefId ? { contextRefId: normalizedRefId } : {}),
          ...(input.contextType === "GENERAL" ? { status: "OPEN" } : {}),
        },
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      participants: { select: { role: true, lastReadSeq: true } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });

  if (existing) {
    // Attach userId or guestEmail smoothly if updated since creating thread
    const patchData: { userId?: string; guestEmail?: string } = {};
    if (actor.userId && !existing.userId) {
      patchData.userId = actor.userId;
      existing.userId = actor.userId;
    }
    if (!actor.userId && input.guestEmail && !existing.guestEmail) {
      const normalized = input.guestEmail.toLowerCase();
      patchData.guestEmail = normalized;
      existing.guestEmail = normalized;
    }
    if (Object.keys(patchData).length > 0) {
      await db.conversation.update({
        where: { id: existing.id },
        data: patchData,
      });
    }
    const unreadCount = actor.isStaff ? existing.adminUnreadCount : existing.customerUnreadCount;
    return formatConversationSummary(existing, unreadCount);
  }

  const initialMsgText = sanitizeChatText(input.initialMessage, 2000);
  const now = new Date();
  const created = await db.$transaction(async (tx) => {
    const conv = await tx.conversation.create({
      data: {
        contextType: input.contextType,
        contextRefId: normalizedRefId,
        customizationRequestId,
        userId: actor.userId,
        guestEmail: actor.userId ? null : (input.guestEmail?.toLowerCase() ?? null),
        guestToken: actor.userId ? null : actor.guestToken,
        guestName: actor.userId ? null : sanitizeChatText(input.guestName, 80) || "Guest Collector",
        status: "OPEN",
        tags: initialTag ? [initialTag] : [],
        lastMessageAt: now,
        lastMessagePreview: initialMsgText ? initialMsgText.slice(0, 140) : null,
      },
      include: {
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        participants: { select: { role: true, lastReadSeq: true } },
      },
    });

    const participant = await tx.conversationParticipant.create({
      data: {
        conversationId: conv.id,
        userId: actor.userId,
        guestEmail: actor.userId ? null : conv.guestEmail,
        role: "CUSTOMER",
        lastReadSeq: 0,
        lastReadAt: now,
      },
    });

    let firstMsg = null;
    if (initialMsgText) {
      firstMsg = await tx.message.create({
        data: {
          conversationId: conv.id,
          senderId: actor.userId,
          senderRole: "CUSTOMER",
          senderName: actor.userName ?? conv.guestName ?? "Guest Collector",
          type: "TEXT",
          body: initialMsgText,
          deliveredAt: now,
        },
      });
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadSeq: firstMsg.seq, lastReadAt: now },
      });
      await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageSeq: firstMsg.seq, adminUnreadCount: 1 },
      });
      conv.lastMessageSeq = firstMsg.seq;
      conv.adminUnreadCount = 1;
    }

    return { conv, firstMsg };
  });

  const targetKeys = buildCustomerTargetKeys(created.conv);
  if (created.firstMsg) {
    await publishRealtimeEvent({
      type: "message.created",
      conversationId: created.conv.id,
      message: formatMessageRow(created.firstMsg) as unknown as Record<string, unknown>,
      customerTargetKeys: targetKeys,
      notifyAdminInbox: true,
    });
  }
  await publishRealtimeEvent({
    type: "conversation.updated",
    conversationId: created.conv.id,
    status: created.conv.status,
    assignedToId: created.conv.assignedToId,
    tags: created.conv.tags,
    lastMessageAt: (created.conv.lastMessageAt ?? now).toISOString(),
    lastMessagePreview: created.conv.lastMessagePreview,
    customerTargetKeys: targetKeys,
    notifyAdminInbox: true,
  });

  return formatConversationSummary(created.conv, 0);
}

export async function listCustomerConversations(actor: ActorIdentity): Promise<{
  conversations: ChatConversationSummaryDTO[];
  totalUnread: number;
}> {
  if (!actor.userId && !actor.guestToken) {
    return { conversations: [], totalUnread: 0 };
  }

  return measureChatOp("chat.listCustomerConversations", async () => {
    const ownershipFilter: Prisma.ConversationWhereInput = actor.userId
      ? actor.guestToken
        ? { OR: [{ userId: actor.userId }, { guestToken: actor.guestToken }] }
        : { userId: actor.userId }
      : { guestToken: actor.guestToken! };

    const rows = await db.conversation.findMany({
      where: ownershipFilter,
      include: {
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        participants: { select: { role: true, lastReadSeq: true } },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 30,
    });

    let totalUnread = 0;
    const conversations = rows.map((row) => {
      const unread = row.customerUnreadCount ?? 0;
      totalUnread += unread;
      return formatConversationSummary(row, unread);
    });

    return { conversations, totalUnread };
  });
}

export async function getConversationDetail(
  conversationId: string,
  actor: ActorIdentity,
  options?: { afterSeq?: number; beforeSeq?: number; limit?: number },
): Promise<ChatConversationDetailDTO> {
  return measureChatOp(
    "chat.getConversationDetail",
    async () => {
      const conv = await db.conversation.findUnique({
        where: { id: conversationId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { name: true } },
          participants: { select: { role: true, lastReadSeq: true } },
        },
      });
      if (!conv) {
        throw new NotFoundError("Conversation was not found.");
      }

      assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

      const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
      const viewerRole = actor.isStaff ? "ADMIN" : "CUSTOMER";

      let messageRows;
      let hasMoreOlder = false;

      if (options?.afterSeq !== undefined && Number.isFinite(options.afterSeq)) {
        messageRows = await db.message.findMany({
          where: {
            conversationId,
            seq: { gt: Math.max(0, options.afterSeq) },
          },
          orderBy: { seq: "asc" },
          take: limit,
        });
      } else {
        const rawDesc = await db.message.findMany({
          where: {
            conversationId,
            ...(options?.beforeSeq !== undefined && Number.isFinite(options.beforeSeq)
              ? { seq: { lt: options.beforeSeq } }
              : {}),
          },
          orderBy: { seq: "desc" },
          take: limit + 1,
        });
        hasMoreOlder = rawDesc.length > limit;
        messageRows = rawDesc.slice(0, limit).reverse();
      }

      const settings = await getPublicStoreSettings();

      const messages = messageRows.map(formatMessageRow);
      const oldestSeq = messages[0]?.seq ?? null;
      const newestSeq = messages[messages.length - 1]?.seq ?? conv.lastMessageSeq ?? 0;
      const unreadCount = viewerRole === "ADMIN" ? conv.adminUnreadCount : conv.customerUnreadCount;

      const result: ChatConversationDetailDTO = {
        conversation: formatConversationSummary(conv, unreadCount),
        messages,
        hasMoreOlder,
        oldestSeq,
        newestSeq,
        supportStatus: isAtelierSupportOnline(settings.supportHours),
      };

      if (actor.isStaff && actor.role && hasPermission(actor.role, "chat:manage")) {
        const [notes, recentOrders, recentCustomizations] = await Promise.all([
          db.conversationNote.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: 50,
          }),
          conv.userId
            ? db.order.findMany({
                where: { userId: conv.userId },
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  total: true,
                  currency: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
          conv.userId
            ? db.customizationRequest.findMany({
                where: { userId: conv.userId },
                include: { product: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
        ]);

        result.notes = notes.map((n) => ({
          id: n.id,
          authorId: n.authorId,
          authorName: n.authorName,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
        }));
        result.customerContext = {
          recentOrders: recentOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            total: o.total.toFixed(2),
            currency: o.currency,
            createdAt: o.createdAt.toISOString(),
          })),
          recentCustomizations: recentCustomizations.map((c) => ({
            id: c.id,
            requestNumber: c.requestNumber,
            productName: c.product.name,
            status: c.status,
            quotedPriceBase: c.quotedPriceBase ? c.quotedPriceBase.toFixed(2) : null,
            createdAt: c.createdAt.toISOString(),
          })),
        };
      }

      return result;
    },
    { conversationId },
  );
}

export async function getConversationMessagesPage(
  conversationId: string,
  actor: ActorIdentity,
  options?: { cursor?: string | null; afterSeq?: number; beforeSeq?: number; limit?: number },
): Promise<ChatMessagesPageDTO> {
  return measureChatOp(
    "chat.getConversationMessagesPage",
    async () => {
      const conv = await db.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          userId: true,
          guestToken: true,
          guestEmail: true,
          lastMessageSeq: true,
          updatedAt: true,
          participants: { select: { role: true, lastReadSeq: true } },
        },
      });
      if (!conv) {
        throw new NotFoundError("Conversation was not found.");
      }
      assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

      const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
      let effectiveBeforeSeq =
        options?.beforeSeq !== undefined && Number.isFinite(options.beforeSeq)
          ? options.beforeSeq
          : undefined;
      if (effectiveBeforeSeq === undefined && options?.cursor) {
        const parsedCursor = Number(options.cursor);
        if (Number.isFinite(parsedCursor) && parsedCursor > 0) {
          effectiveBeforeSeq = parsedCursor;
        }
      }

      const viewerRole = actor.isStaff ? "ADMIN" : "CUSTOMER";
      let lastReadSeq = 0;
      for (const p of conv.participants) {
        if (viewerRole === "CUSTOMER" && p.role === "CUSTOMER") {
          lastReadSeq = Math.max(lastReadSeq, p.lastReadSeq);
        } else if (viewerRole === "ADMIN" && (p.role === "ADMIN" || p.role === "STAFF")) {
          lastReadSeq = Math.max(lastReadSeq, p.lastReadSeq);
        }
      }

      let messageRows;
      let hasMoreOlder = false;

      if (options?.afterSeq !== undefined && Number.isFinite(options.afterSeq)) {
        messageRows = await db.message.findMany({
          where: {
            conversationId,
            seq: { gt: Math.max(0, options.afterSeq) },
          },
          orderBy: { seq: "asc" },
          take: limit,
        });
      } else {
        const rawDesc = await db.message.findMany({
          where: {
            conversationId,
            ...(effectiveBeforeSeq !== undefined ? { seq: { lt: effectiveBeforeSeq } } : {}),
          },
          orderBy: { seq: "desc" },
          take: limit + 1,
        });
        hasMoreOlder = rawDesc.length > limit;
        messageRows = rawDesc.slice(0, limit).reverse();
      }

      const messages = messageRows.map(formatMessageRow);
      const oldestSeq = messages[0]?.seq ?? null;
      const newestSeq = messages[messages.length - 1]?.seq ?? conv.lastMessageSeq ?? 0;
      const nextCursor = hasMoreOlder && oldestSeq ? String(oldestSeq) : null;
      const etag = `W/"msg-${conversationId}-${conv.lastMessageSeq}-${conv.updatedAt.getTime()}-${effectiveBeforeSeq ?? "latest"}-${options?.afterSeq ?? ""}-${limit}"`;

      return {
        messages,
        hasMoreOlder,
        nextCursor,
        oldestSeq,
        newestSeq,
        lastReadSeq,
        etag,
      };
    },
    { conversationId },
  );
}

export async function getChatBootstrap(
  actor: ActorIdentity,
  options?: { conversationId?: string | null; limit?: number },
): Promise<ChatBootstrapDTO> {
  return measureChatOp("chat.bootstrap", async () => {
    const canManageChat = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);

    const [{ conversations, totalUnread }, settings] = await Promise.all([
      listCustomerConversations(actor),
      getPublicStoreSettings(),
    ]);
    const supportStatus = isAtelierSupportOnline(settings.supportHours);

    const requestedConvId = options?.conversationId?.trim() || null;
    const preferredConv =
      (requestedConvId ? conversations.find((c) => c.id === requestedConvId) : null) ??
      conversations.find((c) => c.status === "OPEN") ??
      conversations[0] ??
      null;

    let activeDetail: ChatConversationDetailDTO | null = null;
    if (preferredConv) {
      try {
        activeDetail = await getConversationDetail(preferredConv.id, actor, { limit });
      } catch {
        activeDetail = null;
      }
    }

    return {
      session: {
        authenticated: Boolean(actor.userId || actor.guestToken),
        userId: actor.userId,
        userName: actor.userName ?? "Guest",
        userEmail: actor.userEmail ?? null,
        role: actor.role,
        isStaff: canManageChat,
        guestToken: actor.guestToken,
        targetKeys: actor.allOwnerKeys,
      },
      conversations,
      totalUnread,
      activeDetail,
      supportStatus,
      limits: {
        maxAttachments: 5,
        maxBytes: MAX_CUSTOMER_IMAGE_UPLOAD_BYTES,
        acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
      },
    };
  });
}

export async function sendChatMessage(
  input: z.infer<typeof sendMessageSchema>,
  actor: ActorIdentity,
  clientIp: string,
): Promise<{ message: ChatMessageDTO; deduplicated: boolean }> {
  return measureChatOp(
    "chat.sendChatMessage",
    async () => {
      const conv = await db.conversation.findUnique({
        where: { id: input.conversationId },
        select: {
          id: true,
          contextType: true,
          contextRefId: true,
          userId: true,
          guestToken: true,
          guestEmail: true,
          guestName: true,
          status: true,
          tags: true,
          assignedToId: true,
          lastOfflineEmailSentAt: true,
          user: { select: { name: true, email: true } },
        },
      });
      if (!conv) {
        throw new NotFoundError("Conversation was not found.");
      }

      assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

      await enforceRateLimit("chatMessage", `${actor.primaryOwnerKey}:${clientIp}`);

      // Idempotency check using clientTempId
      if (input.clientTempId) {
        const existing = await db.message.findUnique({
          where: {
            conversationId_clientTempId: {
              conversationId: conv.id,
              clientTempId: input.clientTempId,
            },
          },
        });
        if (existing) {
          return { message: formatMessageRow(existing), deduplicated: true };
        }
      }

      const sanitizedBody = sanitizeChatText(input.body, 2000);
      const incomingAttachments = input.attachments ?? [];

      for (const att of incomingAttachments) {
        if (!isStorageKeyOwnedByActor(att.storageKey, "chat", actor.allOwnerKeys)) {
          throw new ForbiddenError("Attachment upload does not belong to your active session.");
        }
      }

      let refSnapshot: ChatRefSnapshot | null = null;
      let canonicalRefId: string | null = input.refId ?? null;
      let fallbackPreview = sanitizedBody;

      if (input.type === "PRODUCT" || input.type === "REQUEST" || input.type === "ORDER") {
        if (!input.refId) {
          throw new ValidationError("Reference item ID is required.");
        }
        const resolved = await resolveReferenceSnapshot(input.type, input.refId, actor);
        canonicalRefId = resolved.canonicalRefId;
        refSnapshot = resolved.snapshot;
        if (!fallbackPreview) {
          fallbackPreview = resolved.previewLabel;
        }
      } else if (incomingAttachments.length > 0 && !fallbackPreview) {
        fallbackPreview =
          incomingAttachments.length === 1
            ? "Sent an image"
            : `Sent ${incomingAttachments.length} images`;
      }

      const effectiveType =
        input.type === "TEXT" && incomingAttachments.length > 0 && !sanitizedBody
          ? "IMAGE"
          : input.type;

      const isAdminSender = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
      const senderRole = isAdminSender ? "ADMIN" : "CUSTOMER";
      const senderName = isAdminSender
        ? (actor.userName ?? "Customer Care")
        : (actor.userName ?? conv.guestName ?? "Guest Collector");

      const now = new Date();
      const attachmentExpiry = new Date(
        now.getTime() + env.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );

      const created = await db.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId: conv.id,
            senderId: actor.userId,
            senderRole,
            senderName,
            type: effectiveType,
            body: sanitizedBody,
            attachments:
              incomingAttachments.length > 0
                ? (incomingAttachments as unknown as Prisma.InputJsonValue)
                : undefined,
            refId: canonicalRefId,
            refSnapshot: refSnapshot
              ? (refSnapshot as unknown as Prisma.InputJsonValue)
              : undefined,
            clientTempId: input.clientTempId ?? null,
            deliveredAt: now,
          },
        });

        if (incomingAttachments.length > 0) {
          await tx.chatAttachment.createMany({
            data: incomingAttachments.map((att) => {
              const signed = createSignedPrivateMediaUrl({
                kind: "chat",
                recordId: conv.id,
                storageKey: att.storageKey,
                thumb: false,
              });
              const thumbKey = att.thumbKey ?? att.storageKey.replace(/\.webp$/, "-thumb.webp");
              const signedThumb = createSignedPrivateMediaUrl({
                kind: "chat",
                recordId: conv.id,
                storageKey: thumbKey,
                thumb: true,
              });

              return {
                conversationId: conv.id,
                messageId: msg.id,
                uploaderId: actor.userId,
                guestToken: actor.guestToken,
                storageKey: att.storageKey,
                url: signed.url,
                thumbUrl: signedThumb.url,
                mimeType: att.mimeType ?? "image/webp",
                sizeBytes: att.sizeBytes,
                width: att.width ?? null,
                height: att.height ?? null,
                originalName: att.originalName ?? null,
                exifStripped: true,
                scanStatus: "CLEAN",
                expiresAt: attachmentExpiry,
              };
            }),
          });
        }

        if (actor.userId) {
          await tx.conversationParticipant.upsert({
            where: {
              conversationId_userId: {
                conversationId: conv.id,
                userId: actor.userId,
              },
            },
            update: {
              role: senderRole,
              lastReadSeq: msg.seq,
              lastReadAt: now,
            },
            create: {
              conversationId: conv.id,
              userId: actor.userId,
              role: senderRole,
              lastReadSeq: msg.seq,
              lastReadAt: now,
            },
          });
        } else {
          const existingPart = await tx.conversationParticipant.findFirst({
            where: { conversationId: conv.id, role: "CUSTOMER" },
            select: { id: true },
          });
          if (existingPart) {
            await tx.conversationParticipant.update({
              where: { id: existingPart.id },
              data: { lastReadSeq: msg.seq, lastReadAt: now },
            });
          } else {
            await tx.conversationParticipant.create({
              data: {
                conversationId: conv.id,
                guestEmail: conv.guestEmail,
                role: "CUSTOMER",
                lastReadSeq: msg.seq,
                lastReadAt: now,
              },
            });
          }
        }

        const updatedConv = await tx.conversation.update({
          where: { id: conv.id },
          data: {
            status: conv.status === "CLOSED" || conv.status === "RESOLVED" ? "OPEN" : conv.status,
            lastMessageAt: now,
            lastMessageSeq: msg.seq,
            lastMessagePreview: fallbackPreview.slice(0, 140),
            ...(senderRole === "ADMIN"
              ? { customerUnreadCount: { increment: 1 }, adminUnreadCount: 0 }
              : { adminUnreadCount: { increment: 1 }, customerUnreadCount: 0 }),
            ...(isAdminSender && !conv.assignedToId ? { assignedToId: actor.userId } : {}),
          },
          select: {
            status: true,
            assignedToId: true,
            tags: true,
            lastMessagePreview: true,
          },
        });

        return { msg, updatedConv };
      });

      const messageDto = formatMessageRow(created.msg);
      const customerTargetKeys = buildCustomerTargetKeys(conv);

      // Emit realtime events in parallel without serializing them on the hot ACK path
      await Promise.all([
        publishRealtimeEvent({
          type: "message.created",
          conversationId: conv.id,
          message: messageDto as unknown as Record<string, unknown>,
          customerTargetKeys,
          notifyAdminInbox: true,
        }),
        publishRealtimeEvent({
          type: "conversation.updated",
          conversationId: conv.id,
          status: created.updatedConv.status,
          assignedToId: created.updatedConv.assignedToId,
          tags: created.updatedConv.tags,
          lastMessageAt: now.toISOString(),
          lastMessagePreview: created.updatedConv.lastMessagePreview,
          customerTargetKeys,
          notifyAdminInbox: true,
        }),
      ]);

      // Off-critical-path offline notification email dispatch
      if (senderRole === "ADMIN") {
        const recipientEmail = conv.user?.email ?? conv.guestEmail;
        const recipientName = conv.user?.name ?? conv.guestName ?? "Collector";
        if (recipientEmail && !recipientEmail.endsWith("@anonymized.local")) {
          const cooldownMs = env.CHAT_OFFLINE_EMAIL_COOLDOWN_MINUTES * 60 * 1000;
          const cooldownPassed =
            !conv.lastOfflineEmailSentAt ||
            now.getTime() - conv.lastOfflineEmailSentAt.getTime() >= cooldownMs;

          if (cooldownPassed) {
            void (async () => {
              try {
                const custParticipant = await db.conversationParticipant.findFirst({
                  where: { conversationId: conv.id, role: "CUSTOMER" },
                  select: { lastReadAt: true },
                });
                const customerInactive =
                  !custParticipant?.lastReadAt ||
                  now.getTime() - custParticipant.lastReadAt.getTime() > 2 * 60 * 1000;

                if (customerInactive) {
                  await db.conversation.update({
                    where: { id: conv.id },
                    data: { lastOfflineEmailSentAt: now },
                  });
                  await sendChatOfflineReplyEmail({
                    recipientEmail,
                    recipientName,
                    conversationId: conv.id,
                    subjectLabel: buildConversationSubjectLabel(conv),
                    messagePreview: fallbackPreview.slice(0, 220),
                  });
                }
              } catch (err) {
                logger.warn({ err, conversationId: conv.id }, "Offline chat email failed");
              }
            })();
          }
        }
      }

      return { message: messageDto, deduplicated: false };
    },
    { conversationId: input.conversationId },
  );
}

export async function markConversationRead(
  input: z.infer<typeof markReadSchema>,
  actor: ActorIdentity,
): Promise<{ conversationId: string; lastReadSeq: number; readAt: string }> {
  const conv = await db.conversation.findUnique({
    where: { id: input.conversationId },
    select: {
      id: true,
      userId: true,
      guestToken: true,
      guestEmail: true,
      lastMessageSeq: true,
    },
  });
  if (!conv) {
    throw new NotFoundError("Conversation was not found.");
  }
  assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

  let maxSeq = conv.lastMessageSeq;
  if (maxSeq <= 0) {
    const latest = await db.message.findFirst({
      where: { conversationId: conv.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    maxSeq = latest?.seq ?? 0;
  }

  const effectiveSeq =
    input.lastReadSeq !== undefined ? Math.min(input.lastReadSeq, maxSeq) : maxSeq;

  const readerRole = actor.role && hasPermission(actor.role, "chat:manage") ? "ADMIN" : "CUSTOMER";
  const now = new Date();

  await db.$transaction(async (tx) => {
    if (actor.userId) {
      await tx.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: conv.id,
            userId: actor.userId,
          },
        },
        update: {
          role: readerRole,
          lastReadSeq: effectiveSeq,
          lastReadAt: now,
        },
        create: {
          conversationId: conv.id,
          userId: actor.userId,
          role: readerRole,
          lastReadSeq: effectiveSeq,
          lastReadAt: now,
        },
      });
    } else {
      const existingPart = await tx.conversationParticipant.findFirst({
        where: { conversationId: conv.id, role: "CUSTOMER" },
        select: { id: true },
      });
      if (existingPart) {
        await tx.conversationParticipant.update({
          where: { id: existingPart.id },
          data: { lastReadSeq: effectiveSeq, lastReadAt: now },
        });
      } else {
        await tx.conversationParticipant.create({
          data: {
            conversationId: conv.id,
            guestEmail: conv.guestEmail,
            role: "CUSTOMER",
            lastReadSeq: effectiveSeq,
            lastReadAt: now,
          },
        });
      }
    }

    if (effectiveSeq > 0) {
      await tx.message.updateMany({
        where: {
          conversationId: conv.id,
          seq: { lte: effectiveSeq },
          senderRole: readerRole === "CUSTOMER" ? { not: "CUSTOMER" } : "CUSTOMER",
          readAt: null,
        },
        data: {
          readAt: now,
          deliveredAt: now,
        },
      });
    }

    const remainingUnread =
      effectiveSeq >= maxSeq
        ? 0
        : await tx.message.count({
            where: {
              conversationId: conv.id,
              seq: { gt: effectiveSeq },
              senderRole: readerRole === "CUSTOMER" ? { not: "CUSTOMER" } : "CUSTOMER",
            },
          });

    await tx.conversation.update({
      where: { id: conv.id },
      data:
        readerRole === "CUSTOMER"
          ? { customerUnreadCount: remainingUnread }
          : { adminUnreadCount: remainingUnread },
    });
  });

  const readAtIso = now.toISOString();
  void publishRealtimeEvent({
    type: "conversation.read",
    conversationId: conv.id,
    readerRole,
    lastReadSeq: effectiveSeq,
    readAt: readAtIso,
    customerTargetKeys: buildCustomerTargetKeys(conv),
  });

  return {
    conversationId: conv.id,
    lastReadSeq: effectiveSeq,
    readAt: readAtIso,
  };
}

export async function listAdminConversations(
  query: z.infer<typeof adminListConversationsSchema>,
  currentUserId: string,
): Promise<{
  items: ChatConversationSummaryDTO[];
  totalCount: number;
  totalUnreadCount: number;
  staffMembers: Array<{ id: string; name: string; role: string }>;
}> {
  return measureChatOp("chat.listAdminConversations", async () => {
    const andClauses: Prisma.ConversationWhereInput[] = [];

    if (query.status !== "ALL") {
      andClauses.push({ status: query.status });
    }
    if (query.contextType !== "ALL") {
      andClauses.push({ contextType: query.contextType });
    }
    if (query.assignedToId === "UNASSIGNED") {
      andClauses.push({ assignedToId: null });
    } else if (query.assignedToId === "ME") {
      andClauses.push({ assignedToId: currentUserId });
    } else if (query.assignedToId !== "ALL") {
      andClauses.push({ assignedToId: query.assignedToId });
    }
    if (query.tag) {
      andClauses.push({ tags: { has: query.tag } });
    }
    if (query.unreadOnly) {
      andClauses.push({ adminUnreadCount: { gt: 0 } });
    }
    if (query.search) {
      const q = query.search.trim();
      andClauses.push({
        OR: [
          { id: { contains: q, mode: "insensitive" } },
          { guestName: { contains: q, mode: "insensitive" } },
          { guestEmail: { contains: q, mode: "insensitive" } },
          { lastMessagePreview: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.ConversationWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

    const cachedStaff =
      await cacheGetJson<Array<{ id: string; name: string; role: string }>>(
        "chat:staff-members:v1",
      );

    const [rows, totalCount, unreadAgg, staffMembers] = await Promise.all([
      db.conversation.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          assignedTo: { select: { name: true } },
          participants: { select: { role: true, lastReadSeq: true } },
        },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.conversation.count({ where }),
      db.conversation.aggregate({
        where: { status: "OPEN", adminUnreadCount: { gt: 0 } },
        _sum: { adminUnreadCount: true },
      }),
      cachedStaff
        ? Promise.resolve(cachedStaff)
        : db.user
            .findMany({
              where: { role: { in: ["ADMIN", "STAFF"] }, anonymizedAt: null },
              select: { id: true, name: true, role: true },
              orderBy: { name: "asc" },
            })
            .then(async (staff) => {
              await cacheSetJson("chat:staff-members:v1", staff, 60);
              return staff;
            }),
    ]);

    const items = rows.map((row) => formatConversationSummary(row, row.adminUnreadCount ?? 0));

    return {
      items,
      totalCount,
      totalUnreadCount: unreadAgg._sum.adminUnreadCount ?? 0,
      staffMembers,
    };
  });
}

export async function adminUpdateConversation(
  input: z.infer<typeof adminUpdateConversationSchema>,
  staffActor: { id: string; email: string; role: string },
): Promise<ChatConversationSummaryDTO> {
  const existing = await db.conversation.findUnique({
    where: { id: input.conversationId },
  });
  if (!existing) {
    throw new NotFoundError("Conversation not found.");
  }

  const nextTags =
    input.tags !== undefined
      ? Array.from(new Set(input.tags.map((t) => sanitizeChatText(t, 40)).filter(Boolean)))
      : undefined;

  const updated = await db.conversation.update({
    where: { id: existing.id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(nextTags !== undefined ? { tags: nextTags } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      participants: { select: { role: true, lastReadSeq: true } },
    },
  });

  await writeAuditLog({
    actorId: staffActor.id,
    actorEmail: staffActor.email,
    actorRole: staffActor.role,
    action: "chat.conversation.updated",
    entityType: "Conversation",
    entityId: updated.id,
    after: {
      status: updated.status,
      assignedToId: updated.assignedToId,
      tags: updated.tags,
    },
  });

  await publishRealtimeEvent({
    type: "conversation.updated",
    conversationId: updated.id,
    status: updated.status,
    assignedToId: updated.assignedToId,
    tags: updated.tags,
    lastMessageAt: (updated.lastMessageAt ?? updated.updatedAt).toISOString(),
    lastMessagePreview: updated.lastMessagePreview,
    customerTargetKeys: buildCustomerTargetKeys(updated),
    notifyAdminInbox: true,
  });

  return formatConversationSummary(updated, updated.adminUnreadCount);
}

export async function adminAddConversationNote(
  input: z.infer<typeof adminAddNoteSchema>,
  staffActor: { id: string; email: string; name: string | null; role: string },
): Promise<ChatNoteDTO> {
  const existing = await db.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundError("Conversation not found.");
  }

  const body = sanitizeChatText(input.body, 2000);
  if (!body) {
    throw new ValidationError("Note text cannot be empty.");
  }

  const note = await db.conversationNote.create({
    data: {
      conversationId: existing.id,
      authorId: staffActor.id,
      authorName: staffActor.name ?? staffActor.email,
      body,
    },
  });

  return {
    id: note.id,
    authorId: note.authorId,
    authorName: note.authorName,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  };
}

const CANNED_REPLIES_CACHE_KEY_ACTIVE = "chat:canned-replies:v1:active";
const CANNED_REPLIES_CACHE_KEY_ALL = "chat:canned-replies:v1:all";

export async function listCannedReplies(includeInactive = false): Promise<ChatCannedReplyDTO[]> {
  const cacheKey = includeInactive ? CANNED_REPLIES_CACHE_KEY_ALL : CANNED_REPLIES_CACHE_KEY_ACTIVE;
  const cached = await cacheGetJson<ChatCannedReplyDTO[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const rows = await db.chatCannedReply.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const result = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    body: r.body,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
  await cacheSetJson(cacheKey, result, 300);
  return result;
}

export async function upsertCannedReply(
  input: z.infer<typeof adminCannedReplySchema>,
): Promise<ChatCannedReplyDTO> {
  const title = sanitizeChatText(input.title, 80);
  const body = sanitizeChatText(input.body, 2000);
  const category = input.category ? sanitizeChatText(input.category, 60) : null;

  const row = input.id
    ? await db.chatCannedReply.update({
        where: { id: input.id },
        data: { title, category, body, sortOrder: input.sortOrder, isActive: input.isActive },
      })
    : await db.chatCannedReply.create({
        data: { title, category, body, sortOrder: input.sortOrder, isActive: input.isActive },
      });

  await Promise.all([
    cacheDeleteKey(CANNED_REPLIES_CACHE_KEY_ACTIVE),
    cacheDeleteKey(CANNED_REPLIES_CACHE_KEY_ALL),
  ]);

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    body: row.body,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function deleteCannedReply(id: string): Promise<{ deleted: true }> {
  await db.chatCannedReply.delete({ where: { id } });
  await Promise.all([
    cacheDeleteKey(CANNED_REPLIES_CACHE_KEY_ACTIVE),
    cacheDeleteKey(CANNED_REPLIES_CACHE_KEY_ALL),
  ]);
  return { deleted: true };
}

export interface ChatProductSearchResult {
  items: ChatRefSnapshotProduct[];
  nextCursor: string | null;
}

export async function searchShareableProductsForChatPage(
  query: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<ChatProductSearchResult> {
  return measureChatOp("chat.searchShareableProducts", async () => {
    const q = query.trim();
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 40);
    const cursor = options?.cursor?.trim() || null;
    const cacheKey = `chat:products:v2:${q.toLowerCase()}:${cursor ?? ""}:${limit}`;

    const cached = await cacheGetJson<ChatProductSearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = await db.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        sku: true,
        name: true,
        basePrice: true,
        priceMode: true,
        category: { select: { name: true } },
        images: {
          select: { thumbUrl: true, url: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        variants: {
          where: { isActive: true, stockQty: { gt: 0 } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;

    const items: ChatRefSnapshotProduct[] = slice.map((p) => {
      const thumbUrl = p.images[0]?.thumbUrl ?? p.images[0]?.url ?? null;
      const basePrice = p.basePrice.toFixed(2);
      return {
        kind: "PRODUCT",
        id: p.id,
        productId: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        imageUrl: thumbUrl,
        thumbUrl,
        basePrice,
        price: basePrice,
        priceMode: p.priceMode,
        currency: "USD",
        inStock: p.variants.length > 0 || p.priceMode === "PRICE_ON_REQUEST",
      };
    });

    const result = { items, nextCursor };
    await cacheSetJson(cacheKey, result, 120);
    return result;
  });
}

export async function searchShareableProductsForChat(
  query: string,
  limit = 20,
): Promise<ChatRefSnapshotProduct[]> {
  const page = await searchShareableProductsForChatPage(query, { limit });
  return page.items;
}

export async function listShareableCustomerItemsForChat(actor: ActorIdentity): Promise<{
  requests: ChatRefSnapshotRequest[];
  orders: ChatRefSnapshotOrder[];
}> {
  if (!actor.userId && !actor.guestToken) {
    return { requests: [], orders: [] };
  }

  const reqWhere: Prisma.CustomizationRequestWhereInput = actor.userId
    ? actor.guestToken
      ? { OR: [{ userId: actor.userId }, { guestToken: actor.guestToken }] }
      : { userId: actor.userId }
    : { guestToken: actor.guestToken! };

  const [reqs, orders] = await Promise.all([
    db.customizationRequest.findMany({
      where: reqWhere,
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    actor.userId
      ? db.order.findMany({
          where: { userId: actor.userId },
          include: { _count: { select: { items: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return {
    requests: reqs.map((r) => ({
      kind: "REQUEST",
      requestId: r.id,
      requestNumber: r.requestNumber,
      productName: r.product.name,
      productSlug: r.product.slug,
      status: r.status,
      quotedPriceBase: r.quotedPriceBase ? r.quotedPriceBase.toFixed(2) : null,
    })),
    orders: orders.map((o) => ({
      kind: "ORDER",
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total.toFixed(2),
      currency: o.currency,
      itemCount: o._count.items,
    })),
  };
}

export async function getAdminChatUnreadCount(): Promise<number> {
  const agg = await db.conversation.aggregate({
    where: { status: "OPEN", adminUnreadCount: { gt: 0 } },
    _sum: { adminUnreadCount: true },
  });
  return agg._sum.adminUnreadCount ?? 0;
}

export async function purgeExpiredChatData(): Promise<{
  deletedAttachments: number;
  deletedConversations: number;
}> {
  const now = new Date();
  const expiredAttachments = await db.chatAttachment.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true, storageKey: true },
    take: 200,
  });

  for (const att of expiredAttachments) {
    await deletePrivateMediaObject(att.storageKey);
  }
  if (expiredAttachments.length > 0) {
    await db.chatAttachment.deleteMany({
      where: { id: { in: expiredAttachments.map((a) => a.id) } },
    });
  }

  const cutoff = new Date(now.getTime() - env.CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const oldConvs = await db.conversation.findMany({
    where: {
      status: { in: ["RESOLVED", "CLOSED"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 100,
  });
  if (oldConvs.length > 0) {
    await db.conversation.deleteMany({
      where: { id: { in: oldConvs.map((c) => c.id) } },
    });
  }

  return {
    deletedAttachments: expiredAttachments.length,
    deletedConversations: oldConvs.length,
  };
}
