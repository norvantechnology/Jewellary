import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo/site";
import { getOptionalSession } from "@/server/dal";
import { callTelegram, telegramConfig } from "@/server/telegram";

/**
 * One-time setup (admin only): open /api/telegram/setup while signed in as admin.
 * Registers the webhook with Telegram and reports the bot and alert chats.
 */
export async function GET() {
  const session = await getOptionalSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Sign in as an admin first." }, { status: 401 });
  }
  const cfg = telegramConfig();
  if (!cfg.token || !cfg.webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET, then redeploy." },
      { status: 400 },
    );
  }
  const webhookUrl = `${getSiteUrl()}/api/telegram/webhook`;
  const [bot, setWebhook] = await Promise.all([
    callTelegram<{ username: string }>("getMe", {}),
    callTelegram("setWebhook", {
      url: webhookUrl,
      secret_token: cfg.webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  ]);
  const info = await callTelegram("getWebhookInfo", {});
  return NextResponse.json({
    ok: Boolean(bot && setWebhook),
    bot: bot ? `@${bot.username}` : "token rejected by Telegram",
    webhookUrl,
    webhook: info,
    alertChats: cfg.chatIds.length
      ? cfg.chatIds
      : "none yet: message your bot /id, then add the ID to TELEGRAM_CHAT_IDS",
  });
}
