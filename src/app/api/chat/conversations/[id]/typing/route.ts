import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { assertCustomerOrGuestOwnership, resolveActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";
import { publishRealtimeEvent } from "@/server/realtime/realtime-bus";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor, bodyRaw] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
      req.json().catch(() => ({})),
    ]);
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true, guestToken: true, guestName: true },
    });
    if (!conv) {
      throw new NotFoundError("Conversation was not found.");
    }
    assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

    const body = bodyRaw as { isTyping?: boolean };
    const isStaff = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
    const customerTargetKeys: string[] = [];
    if (conv.userId) customerTargetKeys.push(`user:${conv.userId}`);
    if (conv.guestToken) customerTargetKeys.push(`guest:${conv.guestToken}`);

    await publishRealtimeEvent({
      type: "typing",
      conversationId: conv.id,
      actorRole: isStaff ? "ADMIN" : "CUSTOMER",
      actorName: isStaff
        ? (actor.userName ?? "Atelier Concierge")
        : (actor.userName ?? conv.guestName ?? "Guest Collector"),
      isTyping: Boolean(body.isTyping),
      customerTargetKeys,
      notifyAdminInbox: !isStaff,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonApiError(err);
  }
}
