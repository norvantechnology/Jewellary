import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendChatMessage } from "@/modules/chat/chat.service";
import { replyToAdminEnquiry } from "@/modules/enquiries/enquiry.service";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { parseTelegramRef, sendTelegramMessage, telegramConfig, tgEscape } from "@/server/telegram";

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { first_name?: string; username?: string };
    reply_to_message?: { text?: string };
  };
}

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The store admin that Telegram replies are sent as (first ADMIN account). */
async function getReplyAdmin() {
  return db.user.findFirst({
    where: { role: "ADMIN", banned: { not: true } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      twoFactorEnabled: true,
      phone: true,
    },
  });
}

const HELP = [
  "<b>Store bot</b>",
  "You'll get alerts for new orders, chats, custom requests and inquiries.",
  "",
  "To answer a customer, <b>reply</b> to a chat or inquiry alert (swipe left on it, or long-press → Reply) and type your message.",
  "/id shows this chat's ID.",
].join("\n");

/** Telegram → store: replies from the admin's Telegram chat go to the customer. */
export async function POST(request: Request) {
  const cfg = telegramConfig();
  if (
    !cfg.token ||
    !secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), cfg.webhookSecret)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const msg = update?.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  // Anyone can ask for their chat ID (needed once for setup); nothing else is revealed.
  if (text === "/start" || text === "/id") {
    const allowed = cfg.chatIds.includes(chatId);
    await sendTelegramMessage(
      chatId,
      `Your chat ID is <code>${tgEscape(chatId)}</code>.\n${allowed ? "✅ This chat receives store alerts." : "Add it to TELEGRAM_CHAT_IDS to receive store alerts."}${allowed ? `\n\n${HELP}` : ""}`,
    );
    return NextResponse.json({ ok: true });
  }

  if (!cfg.chatIds.includes(chatId)) return NextResponse.json({ ok: true }); // ignore strangers

  const ref = parseTelegramRef(msg.reply_to_message?.text);
  if (!ref) {
    await sendTelegramMessage(chatId, HELP);
    return NextResponse.json({ ok: true });
  }

  try {
    const admin = await getReplyAdmin();
    if (!admin) throw new Error("No admin account found to send replies as.");

    if (ref.kind === "chat") {
      await sendChatMessage(
        { conversationId: ref.id, type: "TEXT", body: text.slice(0, 2000) },
        {
          userId: admin.id,
          userEmail: admin.email,
          userName: admin.name,
          role: admin.role,
          guestToken: null,
          primaryOwnerKey: `user:${admin.id}`,
          allOwnerKeys: [`user:${admin.id}`],
          isStaff: true,
        },
        "telegram",
      );
      await sendTelegramMessage(chatId, "✅ Sent to the customer's chat.");
    } else {
      await replyToAdminEnquiry(
        {
          enquiryId: ref.id,
          subject: "Re: your inquiry",
          replyMessage: text,
          nextStatus: "RESOLVED",
        },
        {
          user: { ...admin, preferredCurrency: null },
          sessionId: "telegram",
        },
      );
      await sendTelegramMessage(chatId, "✅ Reply emailed to the customer.");
    }
  } catch (err) {
    logger.warn({ err, ref }, "Telegram reply failed");
    await sendTelegramMessage(
      chatId,
      `⚠️ Couldn't send that: ${tgEscape(err instanceof Error ? err.message : "unknown error")}`,
    );
  }
  return NextResponse.json({ ok: true });
}
