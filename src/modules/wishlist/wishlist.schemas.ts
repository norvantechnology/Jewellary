import { z } from "zod";

export const toggleWishlistSchema = z
  .object({
    variantId: z.string().trim().min(4).max(64),
  })
  .strict();

export const removeWishlistSchema = z
  .object({
    variantId: z.string().trim().min(4).max(64),
  })
  .strict();

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;
export type RemoveWishlistInput = z.infer<typeof removeWishlistSchema>;
