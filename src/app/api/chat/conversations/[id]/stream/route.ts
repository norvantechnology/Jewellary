import { assertCustomerOrGuestOwnership, resolveActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";
import { subscribeRealtimeEvents } from "@/server/realtime/realtime-bus";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, actor] = await Promise.all([
      context.params,
      resolveActorIdentity({ createGuestCookie: false }),
    ]);
    const conv = await db.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true, guestToken: true },
    });
    if (!conv) {
      throw new NotFoundError("Conversation was not found.");
    }
    assertCustomerOrGuestOwnership(actor, conv, "chat:manage");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (eventName: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            // Stream already closed
          }
        };

        send("connected", { conversationId: id, ts: Date.now() });

        const unsubscribe = subscribeRealtimeEvents((event) => {
          if ("conversationId" in event && event.conversationId !== id) {
            return;
          }
          if (event.type === "message.created") {
            send("chat:message", event);
          } else if (event.type === "conversation.read") {
            send("chat:read", event);
          } else if (event.type === "conversation.updated") {
            send("chat:conversation", event);
          } else if (event.type === "typing") {
            send("chat:typing", event);
          }
        });

        const heartbeat = setInterval(() => {
          send("ping", { ts: Date.now() });
        }, 25000);

        const cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Ignore double close
          }
        };

        req.signal.addEventListener("abort", cleanup, { once: true });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return jsonApiError(err);
  }
}
