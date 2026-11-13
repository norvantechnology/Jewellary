import { NextResponse } from "next/server";
import { purgeExpiredChatData } from "@/modules/chat/chat.service";
import { runCustomizationExpiryReminderJob } from "@/modules/customization/customization.service";
import { verifyCronAuthorization } from "@/server/cron-auth";

export async function POST(request: Request) {
  const authError = verifyCronAuthorization(request);
  if (authError) return authError;

  const [reminders, chatPurge] = await Promise.all([
    runCustomizationExpiryReminderJob(),
    purgeExpiredChatData(),
  ]);
  return NextResponse.json({ reminders, chatPurge });
}

export async function GET(request: Request) {
  return POST(request);
}
