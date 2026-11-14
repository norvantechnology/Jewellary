import "server-only";
import { after } from "next/server";
import { logger } from "@/server/logger";

/**
 * Telegram bot for store alerts (new orders, chats, custom requests, inquiries) and replies.
 *
 * Env: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHAT_IDS (comma-separated chats that
 * receive alerts and may reply), TELEGRAM_WEBHOOK_SECRET (random string, verifies updates).
 * Every alert ends with a reference tag (e.g. #chat-abc123). Replying to an alert in Telegram
 * sends that text to the customer (chat) or emails it (inquiry).
 */

const API = "https://api.telegram.org";
const MAX_TEXT = 4000;

export function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
  return { token, chatIds, webhookSecret, enabled: Boolean(token && chatIds.length > 0) };
}

/** Escapes text for Telegram HTML messages. */
export function tgEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function callTelegram<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const { token } = telegramConfig();
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      description?: string;
    } | null;
    if (!json?.ok) {
      logger.warn(
        { method, status: res.status, description: json?.description },
        "Telegram API call failed",
      );
      return null;
    }
    return json.result ?? null;
  } catch (err) {
    logger.warn({ err, method }, "Telegram API unreachable");
    return null;
  }
}

/** Sends an HTML message to one chat (used for replies to the admin). */
export async function sendTelegramMessage(chatId: string | number, html: string) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, MAX_TEXT),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Sends an alert to every configured chat after the current response (never slows down or
 * breaks the customer's request). Safe to call anywhere; does nothing when not configured.
 */
export function notifyTelegram(html: string): void {
  const { enabled, chatIds } = telegramConfig();
  if (!enabled) return;
  const task = async () => {
    await Promise.all(chatIds.map((id) => sendTelegramMessage(id, html)));
  };
  try {
    after(task);
  } catch {
    // Outside a request scope (scripts, cron helpers): send in the background.
    void task();
  }
}

function siteUrl(): string {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}
function adminLink(path: string, label: string): string {
  const base = siteUrl();
  return base ? `<a href="${tgEscape(base + path)}">${tgEscape(label)}</a>` : tgEscape(label);
}
const REPLY_HINT = "<i>Reply to this message to answer the customer.</i>";

export const telegramAlerts = {
  chatMessage(input: {
    conversationId: string;
    customerName: string | null;
    customerEmail: string | null;
    body: string;
    isNewConversation?: boolean;
    context?: string | null;
  }) {
    const who = [input.customerName, input.customerEmail].filter(Boolean).join(" · ") || "Guest";
    notifyTelegram(
      [
        input.isNewConversation ? "💬 <b>New chat</b>" : "💬 <b>New chat message</b>",
        `<b>From:</b> ${tgEscape(who)}`,
        input.context ? `<b>About:</b> ${tgEscape(input.context)}` : null,
        "",
        tgEscape(input.body.trim() || "(attachment)"),
        "",
        `${adminLink("/admin/messages", "Open in admin")} · ${REPLY_HINT}`,
        `#chat-${input.conversationId}`,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    );
  },

  inquiry(input: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    type?: string | null;
    productName?: string | null;
    message: string;
  }) {
    notifyTelegram(
      [
        "📩 <b>New inquiry</b>",
        `<b>From:</b> ${tgEscape(input.name)} · ${tgEscape(input.email)}${input.phone ? ` · ${tgEscape(input.phone)}` : ""}`,
        input.type ? `<b>Type:</b> ${tgEscape(input.type)}` : null,
        input.productName ? `<b>Product:</b> ${tgEscape(input.productName)}` : null,
        "",
        tgEscape(input.message.slice(0, 1500)),
        "",
        `${adminLink("/admin/enquiries", "Open in admin")} · <i>Reply to this message to email the customer.</i>`,
        `#inq-${input.id}`,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    );
  },

  customizationRequest(input: {
    id: string;
    requestNumber: string;
    productName: string;
    customerName: string | null;
    customerEmail: string | null;
    summary: string[];
    notes?: string | null;
  }) {
    notifyTelegram(
      [
        `✨ <b>New custom request ${tgEscape(input.requestNumber)}</b>`,
        `<b>Product:</b> ${tgEscape(input.productName)}`,
        `<b>From:</b> ${tgEscape([input.customerName, input.customerEmail].filter(Boolean).join(" · ") || "Guest")}`,
        ...input.summary.slice(0, 12).map((line) => `• ${tgEscape(line)}`),
        input.notes ? `\n<b>Notes:</b> ${tgEscape(input.notes.slice(0, 800))}` : null,
        "",
        adminLink(`/admin/customizations/${input.id}`, "Review and send a quote"),
      ]
        .filter((l) => l !== null)
        .join("\n"),
    );
  },

  paidOrder(input: {
    id: string;
    orderNumber: string;
    total: string;
    customerName: string | null;
    customerEmail: string | null;
    items: Array<{ title: string; quantity: number }>;
    shipTo?: string | null;
  }) {
    notifyTelegram(
      [
        `🛍️ <b>New paid order ${tgEscape(input.orderNumber)}</b>`,
        `<b>Total:</b> ${tgEscape(input.total)}`,
        `<b>Customer:</b> ${tgEscape([input.customerName, input.customerEmail].filter(Boolean).join(" · ") || "Guest")}`,
        input.shipTo ? `<b>Ship to:</b> ${tgEscape(input.shipTo)}` : null,
        ...input.items.slice(0, 15).map((i) => `• ${i.quantity} × ${tgEscape(i.title)}`),
        "",
        adminLink(`/admin/orders/${input.id}`, "Open order"),
      ]
        .filter((l) => l !== null)
        .join("\n"),
    );
  },
};

/** Finds the reference tag (#chat-… or #inq-…) in an alert the admin replied to. */
export function parseTelegramRef(
  text: string | undefined | null,
): { kind: "chat" | "inq"; id: string } | null {
  const match = /#(chat|inq)-([A-Za-z0-9_-]{6,64})/.exec(text ?? "");
  return match ? { kind: match[1] as "chat" | "inq", id: match[2]! } : null;
}
