"use server";

import { subscribeNewsletterSchema } from "@/modules/newsletter/newsletter.schemas";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";

export interface SubscribeNewsletterResult {
  status: "subscribed" | "already_subscribed";
  email: string;
}

export const subscribeNewsletterAction = createAction(
  {
    name: "newsletter.subscribe",
    schema: subscribeNewsletterSchema,
    auth: "public",
    rateLimit: { tier: "newsletter" },
  },
  async ({ email, source }): Promise<SubscribeNewsletterResult> => {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, unsubscribedAt: true },
    });

    if (existing && existing.unsubscribedAt === null) {
      return { status: "already_subscribed", email };
    }

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        source,
      },
      update: {
        unsubscribedAt: null,
        source,
      },
    });

    return { status: "subscribed", email };
  },
);
