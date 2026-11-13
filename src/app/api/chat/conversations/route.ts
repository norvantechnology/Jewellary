import { NextResponse } from "next/server";
import { adminListConversationsSchema, startConversationSchema } from "@/modules/chat/chat.schemas";
import {
  getOrCreateConversation,
  listAdminConversations,
  listCustomerConversations,
} from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { requirePermission } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");

    if (scope === "admin") {
      const ctx = await requirePermission("chat:manage");
      const parsed = adminListConversationsSchema.safeParse({
        status: url.searchParams.get("status") ?? undefined,
        assignedToId: url.searchParams.get("assignedToId") ?? undefined,
        contextType: url.searchParams.get("contextType") ?? undefined,
        tag: url.searchParams.get("tag") ?? undefined,
        unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      });
      if (!parsed.success) {
        throw new ValidationError("Invalid conversation query filters.");
      }
      const data = await listAdminConversations(parsed.data, ctx.user.id);
      return NextResponse.json({ ok: true, data });
    }

    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const data = await listCustomerConversations(actor);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = startConversationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Invalid conversation start payload.",
      );
    }

    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const conversation = await getOrCreateConversation(parsed.data, actor);
    return NextResponse.json({ ok: true, data: { conversation } });
  } catch (err) {
    return jsonApiError(err);
  }
}
