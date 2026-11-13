"use server";

import { revalidatePath } from "next/cache";
import {
  addToCartSchema,
  estimateCartSchema,
  removeCartItemSchema,
  saveForLaterSchema,
  updateCartItemSchema,
} from "@/modules/cart/cart.schemas";
import {
  addCartItemForOwner,
  getCurrentCartSummary,
  mergeGuestCartToUser,
  resolveCurrentCartOwner,
  saveCartItemForLater,
  updateCartItemQtyForOwner,
} from "@/modules/cart/cart.service";
import {
  getServerRequestCurrency,
  resolveActiveCurrencyByCode,
} from "@/modules/currencies/currency.service";
import { calculateCheckoutQuote } from "@/modules/orders/checkout-quote";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";
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
  async ({ variantId, quantity, cartItemId }) => {
    const owner = await resolveCurrentCartOwner(false);
    if (!owner) {
      throw new ValidationError("Your shopping bag session has expired.");
    }
    const cart = await updateCartItemQtyForOwner(owner, variantId, quantity, cartItemId);
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
  async ({ variantId, cartItemId }) => {
    const owner = await resolveCurrentCartOwner(false);
    if (!owner) {
      return { itemCount: 0, subtotal: "0.00" };
    }
    const cart = await updateCartItemQtyForOwner(owner, variantId, 0, cartItemId);
    revalidatePath("/cart");
    return { itemCount: cart.itemCount, subtotal: cart.subtotal };
  },
);

export const saveCartItemForLaterAction = createAction(
  {
    name: "cart.saveForLater",
    schema: saveForLaterSchema,
    auth: "public",
  },
  async ({ variantId, cartItemId }) => {
    const owner = await resolveCurrentCartOwner(false);
    if (!owner) {
      throw new ValidationError("Your shopping bag session has expired.");
    }
    const wishlistVariantIds = await saveCartItemForLater(owner, variantId, cartItemId);
    const cart = await getCurrentCartSummary();
    revalidatePath("/cart");
    revalidatePath("/wishlist");
    return {
      cart,
      wishlistVariantIds,
      wishlistCount: wishlistVariantIds.length,
    };
  },
);

export const estimateCartQuoteAction = createAction(
  {
    name: "cart.estimate",
    schema: estimateCartSchema,
    auth: "public",
  },
  async ({ shippingCountry, shippingZoneId, currency }) => {
    const [cart, settings, zones, resolvedCurrency] = await Promise.all([
      getCurrentCartSummary(),
      getPublicStoreSettings(),
      getAllShippingZones(true),
      currency ? resolveActiveCurrencyByCode(currency) : getServerRequestCurrency(),
    ]);

    const result = calculateCheckoutQuote({
      items: cart.items,
      shippingCountry,
      shippingZoneId,
      zones,
      settings,
      targetCurrency: resolvedCurrency.currency,
    });

    if (!result.ok) {
      throw new ValidationError(result.message);
    }

    return result.quote;
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
