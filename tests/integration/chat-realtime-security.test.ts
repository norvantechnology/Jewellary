// @vitest-environment node
import { createId } from "@paralleldrive/cuid2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportCustomerPersonalData } from "@/modules/account/account.service";
import {
  adminAddConversationNote,
  adminUpdateConversation,
  getConversationDetail,
  getOrCreateConversation,
  listAdminConversations,
  markConversationRead,
  sendChatMessage,
} from "@/modules/chat/chat.service";
import type { ActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { clearEmailOutbox } from "@/server/email/client";
import { ForbiddenError } from "@/server/errors";
import { clearMemoryRateLimits } from "@/server/rate-limit";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

describe("Integration — Real-time Chat Ownership, Idempotency, Private Notes & GDPR", () => {
  const createdUserIds: string[] = [];
  const createdConversationIds: string[] = [];
  let staffUser!: { id: string; email: string; role: string; name: string };
  let buyerActor!: ActorIdentity;
  let otherCustomerActor!: ActorIdentity;

  beforeAll(async () => {
    const suffix = createId().slice(0, 8);
    const [adminRow, buyerRow, otherRow] = await Promise.all([
      db.user.findFirstOrThrow({ where: { role: "ADMIN" } }),
      db.user.create({
        data: {
          id: createId(),
          email: `chat-buyer-${suffix}@example.com`,
          name: "Juliette Moreau",
          role: "CUSTOMER",
          emailVerified: true,
        },
      }),
      db.user.create({
        data: {
          id: createId(),
          email: `chat-other-${suffix}@example.com`,
          name: "Other Client",
          role: "CUSTOMER",
          emailVerified: true,
        },
      }),
    ]);

    createdUserIds.push(buyerRow.id, otherRow.id);
    staffUser = {
      id: adminRow.id,
      email: adminRow.email,
      role: adminRow.role,
      name: adminRow.name,
    };

    buyerActor = {
      userId: buyerRow.id,
      userEmail: buyerRow.email,
      userName: buyerRow.name,
      role: "CUSTOMER",
      guestToken: null,
      primaryOwnerKey: `user:${buyerRow.id}`,
      allOwnerKeys: [`user:${buyerRow.id}`],
      isStaff: false,
    };

    otherCustomerActor = {
      userId: otherRow.id,
      userEmail: otherRow.email,
      userName: otherRow.name,
      role: "CUSTOMER",
      guestToken: null,
      primaryOwnerKey: `user:${otherRow.id}`,
      allOwnerKeys: [`user:${otherRow.id}`],
      isStaff: false,
    };
  });

  beforeEach(() => {
    clearMemoryRateLimits();
    clearEmailOutbox();
  });

  afterAll(async () => {
    if (createdConversationIds.length > 0) {
      await db.conversation.deleteMany({
        where: { id: { in: createdConversationIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await db.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("enforces thread ownership, idempotent delivery, unread counters & strips internal admin notes from GDPR/customer views", async () => {
    const product = await db.product.findFirstOrThrow({ select: { id: true, name: true } });

    const conv = await getOrCreateConversation(
      {
        contextType: "PRODUCT",
        contextRefId: product.id,
      },
      buyerActor,
    );
    createdConversationIds.push(conv.id);

    // Another customer cannot view or post in buyer's conversation
    await expect(getConversationDetail(conv.id, otherCustomerActor)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      sendChatMessage(
        {
          conversationId: conv.id,
          type: "TEXT",
          body: "Hijack attempt",
          attachments: [],
        },
        otherCustomerActor,
        "127.0.0.1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Customer sends message with clientTempId — replay is deduplicated cleanly
    const tempId = `tmp-${createId()}`;
    const firstSend = await sendChatMessage(
      {
        conversationId: conv.id,
        type: "TEXT",
        body: "Could this setting hold a 2.2ct emerald diamond? <script>alert(1)</script>",
        clientTempId: tempId,
        attachments: [],
      },
      buyerActor,
      "127.0.0.1",
    );
    expect(firstSend.deduplicated).toBe(false);
    expect(firstSend.message.body).not.toContain("<script>");

    const replaySend = await sendChatMessage(
      {
        conversationId: conv.id,
        type: "TEXT",
        body: "Could this setting hold a 2.2ct emerald diamond? <script>alert(1)</script>",
        clientTempId: tempId,
        attachments: [],
      },
      buyerActor,
      "127.0.0.1",
    );
    expect(replaySend.deduplicated).toBe(true);
    expect(replaySend.message.id).toBe(firstSend.message.id);

    // Admin sees unread item, adds private internal note, updates tag & replies
    const adminActor: ActorIdentity = {
      userId: staffUser.id,
      userEmail: staffUser.email,
      userName: staffUser.name,
      role: "ADMIN",
      guestToken: null,
      primaryOwnerKey: `user:${staffUser.id}`,
      allOwnerKeys: [`user:${staffUser.id}`],
      isStaff: true,
    };

    const inbox = await listAdminConversations(
      {
        status: "ALL",
        assignedToId: "ALL",
        contextType: "ALL",
        unreadOnly: false,
        page: 1,
        limit: 50,
        search: conv.id,
      },
      staffUser.id,
    );
    const matched = inbox.items.find((i) => i.id === conv.id);
    expect(matched?.unreadCount).toBeGreaterThanOrEqual(1);

    await adminAddConversationNote(
      { conversationId: conv.id, body: "VIP margin check: max 8% discount private note." },
      staffUser,
    );
    await adminUpdateConversation(
      { conversationId: conv.id, tags: ["VIP", "Emerald Cut"], assignedToId: staffUser.id },
      staffUser,
    );

    const adminDetail = await getConversationDetail(conv.id, adminActor);
    expect(adminDetail.notes?.some((n) => n.body.includes("VIP margin check"))).toBe(true);

    // Admin reply increases customer unread count; markConversationRead resets it
    await sendChatMessage(
      {
        conversationId: conv.id,
        type: "PRODUCT",
        body: "Yes, this cathedral setting accommodates emerald cuts cleanly.",
        refId: product.id,
        attachments: [],
      },
      adminActor,
      "127.0.0.1",
    );

    const customerDetailBeforeRead = await getConversationDetail(conv.id, buyerActor);
    expect(customerDetailBeforeRead.notes).toBeUndefined();
    expect(customerDetailBeforeRead.conversation.unreadCount).toBeGreaterThanOrEqual(1);
    expect(
      customerDetailBeforeRead.messages.some((m) => m.type === "PRODUCT" && m.refSnapshot),
    ).toBe(true);

    const readResult = await markConversationRead(
      { conversationId: conv.id, lastReadSeq: customerDetailBeforeRead.newestSeq },
      buyerActor,
    );
    expect(readResult.lastReadSeq).toBe(customerDetailBeforeRead.newestSeq);

    const customerDetailAfterRead = await getConversationDetail(conv.id, buyerActor);
    expect(customerDetailAfterRead.conversation.unreadCount).toBe(0);

    // GDPR export contains customer chat messages but NEVER private admin internal notes
    const gdpr = await exportCustomerPersonalData(buyerActor.userId!);
    const exportedJson = JSON.stringify(gdpr);
    expect(exportedJson).toContain(conv.id);
    expect(exportedJson).not.toContain("VIP margin check");
  });
});
