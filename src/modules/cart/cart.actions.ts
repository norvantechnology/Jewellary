"use server";

import { revalidatePath } from "next/cache";
import {
  addToCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/modules/cart/cart.schemas";
import {
  addCartItemForOwner,
  mergeGuestCartToUser,
  resolveCurrentCartOwner,
  updateCartItemQtyForOwner,
} from "@/modules/cart/cart.service";
import { createAction } from "@/server/create-action";
import { getOptionalSession } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { readGuestTokenFromCookies } from "@/server/guest-token";

export const addToCartAction = createAction(
  {
    name: "cart.add",
    schema: addToCartSchema,
    auth: "public",
  },
  async ({ variantId, quantity }) => {
    const owner = await resolveCurrentCartOwner(true);
    if (!owner) {
      throw new ValidationError("Unable to initialize shopping bag session.");
    }
    const cart = await addCartItemForOwner(owner, variantId, quantity);
    revalidatePath("/cart");
    return cart;
  },
);

export const updateCartItemQtyAction = createAction(
  {
    name: "cart.updateQty",
    schema: updateCartItemSchema,
    auth: "public",
  },
  async ({ variantId, quantity }) => {
    const owner = await resolveCurrentCartOwner(false);
    if (!owner) {
      throw new ValidationError("Your shopping bag session has expired.");
    }
    const cart = await updateCartItemQtyForOwner(owner, variantId, quantity);
    revalidatePath("/cart");
    return cart;
  },
);

export const removeCartItemAction = createAction(
  {
    name: "cart.remove",
    schema: removeCartItemSchema,
    auth: "public",
  },
  async ({ variantId }) => {
    const owner = await resolveCurrentCartOwner(false);
    if (!owner) {
      return { itemCount: 0, subtotal: "0.00" };
    }
    const cart = await updateCartItemQtyForOwner(owner, variantId, 0);
    revalidatePath("/cart");
    return { itemCount: cart.itemCount, subtotal: cart.subtotal };
  },
);

export async function syncGuestCartOnAuthAction(): Promise<{ mergedCount: number }> {
  const session = await getOptionalSession();
  const guestToken = await readGuestTokenFromCookies();
  if (!session?.user || !guestToken) {
    return { mergedCount: 0 };
  }
  const mergedCount = await mergeGuestCartToUser(guestToken, session.user.id);
  revalidatePath("/cart");
  return { mergedCount };
}
