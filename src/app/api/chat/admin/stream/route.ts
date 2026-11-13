import { getAdminChatUnreadCount } from "@/modules/chat/chat.service";
import { requirePermission } from "@/server/dal";
import { jsonApiError } from "@/server/private-media-http";
import { subscribeRealtimeEvents } from "@/server/realtime/realtime-bus";

export async function GET(req: Request) {
  try {
    await requirePermission("chat:manage");
    const initialUnread = await getAdminChatUnreadCount();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const send = (eventName: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            // Closed
          }
        };

        send("connected", { unreadCount: initialUnread, ts: Date.now() });

        const unsubscribe = subscribeRealtimeEvents((event) => {
          if (event.type === "message.created" && event.notifyAdminInbox) {
            send("chat:message", event);
          } else if (event.type === "conversation.updated" && event.notifyAdminInbox) {
            send("chat:conversation", event);
          } else if (event.type === "conversation.read") {
            send("chat:read", event);
          } else if (event.type === "typing" && event.notifyAdminInbox) {
            send("chat:typing", event);
          } else if (event.type === "customization.updated" && event.notifyAdminInbox) {
            send("customization:updated", event);
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
            // Closed
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
