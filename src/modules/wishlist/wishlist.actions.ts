"use server";

import { revalidatePath } from "next/cache";
import { removeWishlistSchema, toggleWishlistSchema } from "@/modules/wishlist/wishlist.schemas";
import {
  mergeGuestWishlistToUser,
  removeWishlistForOwner,
  resolveCurrentWishlistOwner,
  toggleWishlistForOwner,
} from "@/modules/wishlist/wishlist.service";
import { createAction } from "@/server/create-action";
import { getOptionalSession } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { readGuestTokenFromCookies } from "@/server/guest-token";

export const toggleWishlistAction = createAction(
  {
    name: "wishlist.toggle",
    schema: toggleWishlistSchema,
    auth: "public",
  },
  async ({ variantId }) => {
    const { owner } = await resolveCurrentWishlistOwner(true);
    if (!owner) {
      throw new ValidationError("Unable to resolve visitor session for wishlist.");
    }

    const result = await toggleWishlistForOwner(owner, variantId);
    revalidatePath("/wishlist");

    return {
      wishlisted: result.wishlisted,
      count: result.state.count,
      variantIds: result.state.variantIds,
    };
  },
);

export const removeWishlistItemAction = createAction(
  {
    name: "wishlist.remove",
    schema: removeWishlistSchema,
    auth: "public",
  },
  async ({ variantId }) => {
    const { owner } = await resolveCurrentWishlistOwner(false);
    if (!owner) {
      return { count: 0, variantIds: [] as string[] };
    }

    const state = await removeWishlistForOwner(owner, variantId);
    revalidatePath("/wishlist");

    return {
      count: state.count,
      variantIds: state.variantIds,
    };
  },
);

export async function syncGuestWishlistOnAuthAction(): Promise<{ mergedCount: number }> {
  const session = await getOptionalSession();
  const guestToken = await readGuestTokenFromCookies();

  if (!session?.user || !guestToken) {
    return { mergedCount: 0 };
  }

  const mergedCount = await mergeGuestWishlistToUser(guestToken, session.user.id);
  revalidatePath("/wishlist");
  return { mergedCount };
}
