import { NextResponse } from "next/server";
import { purgeExpiredChatData } from "@/modules/chat/chat.service";
import { runCustomizationExpiryReminderJob } from "@/modules/customization/customization.service";
import {
  runCartReminderJob,
  runFeedbackRequestJob,
} from "@/modules/marketing/lifecycle-emails.service";
import { verifyCronAuthorization } from "@/server/cron-auth";

export async function POST(request: Request) {
  const authError = verifyCronAuthorization(request);
  if (authError) return authError;

  const [reminders, chatPurge, cartReminders, feedbackRequests] = await Promise.all([
    runCustomizationExpiryReminderJob(),
    purgeExpiredChatData(),
    runCartReminderJob(),
    runFeedbackRequestJob(),
  ]);
  return NextResponse.json({ reminders, chatPurge, cartReminders, feedbackRequests });
}

export async function GET(request: Request) {
  return POST(request);
}
