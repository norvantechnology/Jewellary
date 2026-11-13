import { NextResponse } from "next/server";
import { getChatBootstrap } from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    const limitParam = url.searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;

    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const data = await getChatBootstrap(actor, {
      conversationId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 30,
    });

    return NextResponse.json(
      { ok: true, data },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    return jsonApiError(err);
  }
}
