import { NextResponse } from "next/server";
import { markReadSchema } from "@/modules/chat/chat.schemas";
import { markConversationRead } from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor, raw] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
      req.json().catch(() => ({})),
    ]);
    const parsed = markReadSchema.safeParse({
      ...raw,
      conversationId: id,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid mark-read payload.");
    }

    const data = await markConversationRead(parsed.data, actor);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return jsonApiError(err);
  }
}
