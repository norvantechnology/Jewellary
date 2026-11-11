import "@/lib/zod-csp";
import { z } from "zod";

export const subscribeNewsletterSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(180),
    source: z.string().trim().max(80).default("footer"),
    website: z.string().max(0, "Spam filter triggered.").optional().default(""),
  })
  .strict();

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
