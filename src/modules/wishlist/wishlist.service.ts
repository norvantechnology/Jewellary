import "server-only";
import { cache } from "react";
import type { PublicCardVariantOptionDTO } from "@/modules/catalog/catalog.public";
import { db } from "@/server/db";
import { getOptionalSession } from "@/server/dal";
import { ConflictError, NotFoundError } from "@/server/errors";
import { getOrCreateGuestTokenCookie, readGuestTokenFromCookies } from "@/server/guest-token";

export interface WishlistItemDTO {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  productId: string;
  productName: string;
  productSlug: string;
  categoryName: string;
  hasSizing: boolean;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  price: string;
  compareAtPrice: string | null;
  availableStock: number;
  imageUrl: string | null;
  imageAltText: string | null;
  metalType: string | null;
  caratTotal: string | null;
  addedAt: string;
  variants: PublicCardVariantOptionDTO[];
}

export interface WishlistStateDTO {
  count: number;
  variantIds: string[];
  items: WishlistItemDTO[];
}

export type WishlistOwner =
  { kind: "user"; userId: string } | { kind: "guest"; guestToken: string };

async function findWishlistWithItems(owner: WishlistOwner) {
  return db.wishlist.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: {
      id: true,
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          variantId: true,
          createdAt: true,
          variant: {
            select: {
              id: true,
              sku: true,
              title: true,
              priceOverride: true,
              compareAtOverride: true,
              stockQty: true,
              reservedQty: true,
              isActive: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  deletedAt: true,
                  priceMode: true,
                  basePrice: true,
                  compareAtPrice: true,
                  hasSizing: true,
                  metalType: true,
                  caratTotal: true,
                  category: {
                    select: { name: true },
                  },
                  variants: {
                    where: { isActive: true },
                    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
                    select: {
                      id: true,
                      sku: true,
                      title: true,
                      size: true,
                      metal: true,
                      stoneSpec: true,
                      priceOverride: true,
                      compareAtOverride: true,
                      stockQty: true,
                      reservedQty: true,
                      isDefault: true,
                    },
                  },
                  images: {
                    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                    take: 1,
                    select: {
                      mediumUrl: true,
                      url: true,
                      altText: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

function mapWishlistRowsToState(
  wishlist: Awaited<ReturnType<typeof findWishlistWithItems>>,
): WishlistStateDTO {
  if (!wishlist) {
    return { count: 0, variantIds: [], items: [] };
  }

  const items: WishlistItemDTO[] = [];
  for (const row of wishlist.items) {
    const p = row.variant.product;
    if (p.status !== "ACTIVE" || p.deletedAt !== null || !row.variant.isActive) {
      continue;
    }

    const price = (row.variant.priceOverride ?? p.basePrice).toString();
    const compareAt = (row.variant.compareAtOverride ?? p.compareAtPrice)?.toString() ?? null;
    const availableStock = Math.max(0, row.variant.stockQty - row.variant.reservedQty);

    items.push({
      id: row.id,
      variantId: row.variantId,
      variantSku: row.variant.sku,
      variantTitle: row.variant.title,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      categoryName: p.category?.name ?? "Fine Jewellery",
      hasSizing: p.hasSizing,
      priceMode: p.priceMode,
      price,
      compareAtPrice: compareAt,
      availableStock,
      imageUrl: p.images[0]?.mediumUrl ?? p.images[0]?.url ?? null,
      imageAltText: p.images[0]?.altText ?? null,
      metalType: p.metalType,
      caratTotal: p.caratTotal?.toString() ?? null,
      addedAt: row.createdAt.toISOString(),
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        size: v.size,
        metal: v.metal,
        stoneSpec: v.stoneSpec,
        price: (v.priceOverride ?? p.basePrice).toString(),
        compareAtPrice: (v.compareAtOverride ?? p.compareAtPrice)?.toString() ?? null,
        availableStock: Math.max(0, v.stockQty - v.reservedQty),
        isDefault: v.isDefault,
      })),
    });
  }

  return {
    count: items.length,
    variantIds: items.map((i) => i.variantId),
    items,
  };
}

/**
 * Idempotently merges all items from a guest wishlist into an authenticated user's wishlist
 * inside a single database transaction and deletes the guest wishlist row.
 */
export async function mergeGuestWishlistToUser(
  guestToken: string,
  userId: string,
): Promise<number> {
  if (!guestToken || !userId) return 0;

  // Fast path: this runs on page renders for signed-in visitors that still carry a guest cookie.
  // Only open a transaction when there is actually a guest wishlist to merge.
  const pending = await db.wishlist.findUnique({ where: { guestToken }, select: { id: true } });
  if (!pending) return 0;

  return db.$transaction(async (tx) => {
    const guestWishlist = await tx.wishlist.findUnique({
      where: { guestToken },
      include: { items: true },
    });

    if (!guestWishlist) {
      return 0;
    }

    if (guestWishlist.items.length === 0) {
      await tx.wishlist.delete({ where: { id: guestWishlist.id } });
      return 0;
    }

    let userWishlist = await tx.wishlist.findUnique({
      where: { userId },
      include: { items: { select: { variantId: true } } },
    });

    if (!userWishlist) {
      userWishlist = await tx.wishlist.create({
        data: { userId },
        include: { items: { select: { variantId: true } } },
      });
    }

    const existingVariantIds = new Set(userWishlist.items.map((item) => item.variantId));
    const newItems = guestWishlist.items.filter((item) => !existingVariantIds.has(item.variantId));

    if (newItems.length > 0) {
      await tx.wishlistItem.createMany({
        data: newItems.map((item) => ({
          wishlistId: userWishlist.id,
          variantId: item.variantId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.wishlist.delete({ where: { id: guestWishlist.id } });
    return newItems.length;
  });
}

export async function getWishlistForOwner(owner: WishlistOwner): Promise<WishlistStateDTO> {
  const row = await findWishlistWithItems(owner);
  return mapWishlistRowsToState(row);
}

export async function toggleWishlistForOwner(
  owner: WishlistOwner,
  variantId: string,
): Promise<{ wishlisted: boolean; state: WishlistStateDTO }> {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: { status: true, deletedAt: true },
      },
    },
  });

  if (
    !variant ||
    !variant.isActive ||
    variant.product.status !== "ACTIVE" ||
    variant.product.deletedAt !== null
  ) {
    throw new NotFoundError("The selected jewellery piece or option is unavailable.");
  }

  let wishlist = await db.wishlist.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
  });

  if (!wishlist) {
    wishlist = await db.wishlist.create({
      data: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    });
  }

  const existing = await db.wishlistItem.findUnique({
    where: {
      wishlistId_variantId: {
        wishlistId: wishlist.id,
        variantId,
      },
    },
  });

  let wishlisted = false;
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    wishlisted = false;
  } else {
    try {
      await db.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          variantId,
        },
      });
      wishlisted = true;
    } catch {
      throw new ConflictError("Item already saved in wishlist.");
    }
  }

  const state = await getWishlistForOwner(owner);
  return { wishlisted, state };
}

export async function removeWishlistForOwner(
  owner: WishlistOwner,
  variantId: string,
): Promise<WishlistStateDTO> {
  const wishlist = await db.wishlist.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: { id: true },
  });

  if (wishlist) {
    await db.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        variantId,
      },
    });
  }

  return getWishlistForOwner(owner);
}

export async function resolveCurrentWishlistOwner(createGuestIfMissing = false): Promise<{
  owner: WishlistOwner | null;
}> {
  const [session, guestToken] = await Promise.all([
    getOptionalSession(),
    readGuestTokenFromCookies(),
  ]);

  if (session?.user) {
    if (guestToken) {
      await mergeGuestWishlistToUser(guestToken, session.user.id);
    }
    return { owner: { kind: "user", userId: session.user.id } };
  }

  if (guestToken) {
    return { owner: { kind: "guest", guestToken } };
  }

  if (createGuestIfMissing) {
    const createdToken = await getOrCreateGuestTokenCookie();
    return { owner: { kind: "guest", guestToken: createdToken } };
  }

  return { owner: null };
}

export const getCurrentWishlistState = cache(async (): Promise<WishlistStateDTO> => {
  const { owner } = await resolveCurrentWishlistOwner(false);
  if (!owner) {
    return { count: 0, variantIds: [], items: [] };
  }
  return getWishlistForOwner(owner);
});
