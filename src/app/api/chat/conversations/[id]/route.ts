import { NextResponse } from "next/server";
import { adminUpdateConversationSchema } from "@/modules/chat/chat.schemas";
import { adminUpdateConversation, getConversationDetail } from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { requirePermission } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
    ]);
    const url = new URL(req.url);
    const afterSeqParam = url.searchParams.get("afterSeq");
    const beforeSeqParam = url.searchParams.get("beforeSeq");
    const limitParam = url.searchParams.get("limit");

    const afterSeq =
      afterSeqParam !== null && afterSeqParam !== "" ? Number(afterSeqParam) : undefined;
    const beforeSeq =
      beforeSeqParam !== null && beforeSeqParam !== "" ? Number(beforeSeqParam) : undefined;
    const limit = limitParam !== null && limitParam !== "" ? Number(limitParam) : undefined;

    const data = await getConversationDetail(id, actor, {
      afterSeq: Number.isFinite(afterSeq) ? afterSeq : undefined,
      beforeSeq: Number.isFinite(beforeSeq) ? beforeSeq : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, ctx, raw] = await Promise.all([
      context.params,
      requirePermission("chat:manage"),
      req.json().catch(() => ({})),
    ]);
    const parsed = adminUpdateConversationSchema.safeParse({
      ...raw,
      conversationId: id,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid conversation update.");
    }

    const updated = await adminUpdateConversation(parsed.data, {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
    });
    return NextResponse.json({ ok: true, data: { conversation: updated } });
  } catch (err) {
    return jsonApiError(err);
  }
}
