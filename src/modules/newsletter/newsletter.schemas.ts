import "@/lib/zod-csp";
import { z } from "zod";

export const NEWSLETTER_STATUS_VALUES = ["PENDING", "CONFIRMED", "UNSUBSCRIBED"] as const;

export const subscribeNewsletterSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(180),
    source: z.string().trim().max(80).default("footer"),
    website: z.string().optional().default(""),
    timingToken: z.string().trim().max(200).optional().default(""),
    turnstileToken: z.string().trim().max(4096).optional().default(""),
  })
  .strict();

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
