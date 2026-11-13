"use server";

import { subscribeNewsletterSchema } from "@/modules/newsletter/newsletter.schemas";
import {
  requestNewsletterSubscription,
  type SubscribeNewsletterResult,
} from "@/modules/newsletter/newsletter.service";
import { assertHumanSubmission } from "@/server/abuse";
import { createAction } from "@/server/create-action";

export type { SubscribeNewsletterResult };

export const subscribeNewsletterAction = createAction(
  {
    name: "newsletter.subscribe",
    schema: subscribeNewsletterSchema,
    auth: "public",
    rateLimit: { tier: "newsletter" },
  },
  async ({ email, source, website, timingToken, turnstileToken }, ctx) => {
    await assertHumanSubmission({
      website,
      timingToken,
      turnstileToken,
      ip: ctx.ip,
    });

    return requestNewsletterSubscription({ email, source });
  },
);
