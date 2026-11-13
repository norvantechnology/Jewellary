import { NextResponse } from "next/server";
import { sendMessageSchema } from "@/modules/chat/chat.schemas";
import { getConversationMessagesPage, sendChatMessage } from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";
import { getClientIp } from "@/server/rate-limit";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
    ]);
    const url = new URL(req.url);

    const cursor = url.searchParams.get("cursor");
    const afterSeqParam = url.searchParams.get("afterSeq");
    const beforeSeqParam = url.searchParams.get("beforeSeq");
    const limitParam = url.searchParams.get("limit");

    const afterSeq =
      afterSeqParam !== null && afterSeqParam !== "" ? Number(afterSeqParam) : undefined;
    const beforeSeq =
      beforeSeqParam !== null && beforeSeqParam !== "" ? Number(beforeSeqParam) : undefined;
    const limit = limitParam !== null && limitParam !== "" ? Number(limitParam) : 30;

    const page = await getConversationMessagesPage(id, actor, {
      cursor,
      afterSeq: Number.isFinite(afterSeq) ? afterSeq : undefined,
      beforeSeq: Number.isFinite(beforeSeq) ? beforeSeq : undefined,
      limit: Number.isFinite(limit) ? limit : 30,
    });

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === page.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: page.etag,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          messages: page.messages,
          hasMoreOlder: page.hasMoreOlder,
          nextCursor: page.nextCursor,
          oldestSeq: page.oldestSeq,
          newestSeq: page.newestSeq,
          lastReadSeq: page.lastReadSeq,
        },
      },
      {
        headers: {
          ETag: page.etag,
          "Cache-Control": "private, no-cache",
        },
      },
    );
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor, raw, ip] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
      req.json().catch(() => ({})),
      getClientIp(),
    ]);
    const parsed = sendMessageSchema.safeParse({
      ...raw,
      conversationId: id,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid message payload.");
    }

    const result = await sendChatMessage(parsed.data, actor, ip);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return jsonApiError(err);
  }
}
