import { NextResponse } from "next/server";
import { adminAddNoteSchema } from "@/modules/chat/chat.schemas";
import { adminAddConversationNote } from "@/modules/chat/chat.service";
import { requirePermission } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ctx = await requirePermission("chat:manage");
    const raw = await req.json().catch(() => ({}));
    const parsed = adminAddNoteSchema.safeParse({
      ...raw,
      conversationId: id,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid note payload.");
    }

    const note = await adminAddConversationNote(parsed.data, {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
    });
    return NextResponse.json({ ok: true, data: { note } });
  } catch (err) {
    return jsonApiError(err);
  }
}
