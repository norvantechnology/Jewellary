import { z } from "zod";

export const addToCartSchema = z
  .object({
    variantId: z.string().trim().min(4).max(64),
    quantity: z.coerce.number().int().min(1).max(10).default(1),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    variantId: z.string().trim().min(4).max(64),
    quantity: z.coerce.number().int().min(0).max(10),
  })
  .strict();

export const removeCartItemSchema = z
  .object({
    variantId: z.string().trim().min(4).max(64),
  })
  .strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
