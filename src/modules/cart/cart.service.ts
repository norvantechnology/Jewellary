import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { multiplyMoney, sumMoney, toDecimal } from "@/lib/money";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { getOrCreateGuestTokenCookie, readGuestTokenFromCookies } from "@/server/guest-token";

export interface CartItemDTO {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  size: string | null;
  metal: string | null;
  productId: string;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  availableStock: number;
  imageUrl: string | null;
  imageAltText: string | null;
  hasPriceChanged: boolean;
  hasStockIssue: boolean;
  isCustomized?: boolean;
  customizationRequestId?: string | null;
  customizationRequestNumber?: string | null;
  customizationSummaryLines?: Array<{ label: string; value: string }>;
  quoteExpiresAt?: string | null;
}

export interface CartSummaryDTO {
  id: string | null;
  currency: string;
  itemCount: number;
  subtotal: string;
  items: CartItemDTO[];
  signatureRequired: boolean;
}

export type CartOwner = { kind: "user"; userId: string } | { kind: "guest"; guestToken: string };

async function loadCartRows(owner: CartOwner) {
  return db.cart.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: {
      id: true,
      currency: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          variantId: true,
          quantity: true,
          unitPriceSnapshot: true,
          customizationRequestId: true,
          customizationConfigKey: true,
          customizationSnapshot: true,
          customUnitPriceBase: true,
          customizationRequest: {
            select: {
              id: true,
              requestNumber: true,
              status: true,
              quotedPriceBase: true,
              quoteExpiresAt: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              title: true,
              size: true,
              metal: true,
              priceOverride: true,
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
                  images: {
                    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                    take: 1,
                    select: {
                      thumbUrl: true,
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

function mapCartToSummary(
  cart: Awaited<ReturnType<typeof loadCartRows>>,
  defaultCurrency: string,
  signatureThreshold: string,
): CartSummaryDTO {
  if (!cart) {
    return {
      id: null,
      currency: defaultCurrency,
      itemCount: 0,
      subtotal: "0.00",
      items: [],
      signatureRequired: false,
    };
  }

  const items: CartItemDTO[] = [];
  const now = new Date();
  for (const row of cart.items) {
    const product = row.variant.product;
    const isCustomized = Boolean(row.customizationRequestId && row.customUnitPriceBase !== null);
    if (
      product.status !== "ACTIVE" ||
      product.deletedAt !== null ||
      !row.variant.isActive ||
      (!isCustomized && product.priceMode !== "FIXED")
    ) {
      continue;
    }

    const reqMeta = row.customizationRequest;
    const isQuoteActive =
      !isCustomized ||
      (reqMeta?.status === "ACCEPTED" && (!reqMeta.quoteExpiresAt || reqMeta.quoteExpiresAt > now));

    const liveUnitPrice = isCustomized
      ? toDecimal((reqMeta?.quotedPriceBase ?? row.customUnitPriceBase!).toString())
      : toDecimal((row.variant.priceOverride ?? product.basePrice).toString());
    const snapshotPrice = toDecimal(row.unitPriceSnapshot.toString());
    const availableStock = isCustomized
      ? isQuoteActive
        ? 1
        : 0
      : Math.max(0, row.variant.stockQty - row.variant.reservedQty);
    const hasStockIssue = availableStock < row.quantity;
    const effectiveQty = availableStock > 0 ? Math.min(row.quantity, availableStock) : 0;
    const lineTotal = multiplyMoney(liveUnitPrice, effectiveQty);

    const snapshotObj =
      row.customizationSnapshot && typeof row.customizationSnapshot === "object"
        ? (row.customizationSnapshot as {
            requestNumber?: string;
            selections?: Array<{ groupLabel?: string; displayValue?: string }>;
          })
        : null;
    const customizationSummaryLines = Array.isArray(snapshotObj?.selections)
      ? snapshotObj.selections
          .filter((s) => s.groupLabel && s.displayValue)
          .map((s) => ({ label: s.groupLabel!, value: s.displayValue! }))
      : [];

    items.push({
      id: row.id,
      variantId: row.variantId,
      variantSku: row.variant.sku,
      variantTitle: row.variant.title,
      size: row.variant.size,
      metal: row.variant.metal,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      quantity: row.quantity,
      unitPrice: liveUnitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      availableStock,
      imageUrl:
        product.images[0]?.mediumUrl ??
        product.images[0]?.thumbUrl ??
        product.images[0]?.url ??
        null,
      imageAltText: product.images[0]?.altText ?? null,
      hasPriceChanged: !liveUnitPrice.eq(snapshotPrice),
      hasStockIssue,
      isCustomized,
      customizationRequestId: row.customizationRequestId ?? null,
      customizationRequestNumber: reqMeta?.requestNumber ?? snapshotObj?.requestNumber ?? null,
      customizationSummaryLines,
      quoteExpiresAt: reqMeta?.quoteExpiresAt ? reqMeta.quoteExpiresAt.toISOString() : null,
    });
  }

  const subtotal = sumMoney(items.map((item) => item.lineTotal));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const signatureRequired = subtotal.gte(toDecimal(signatureThreshold));

  return {
    id: cart.id,
    currency: cart.currency || defaultCurrency,
    itemCount,
    subtotal: subtotal.toFixed(2),
    items,
    signatureRequired,
  };
}

export async function mergeGuestCartToUser(guestToken: string, userId: string): Promise<number> {
  if (!guestToken || !userId) return 0;

  // Fast path: this runs on page renders for signed-in visitors that still carry a guest cookie.
  // Only open a transaction when there is actually a guest cart to merge.
  const pending = await db.cart.findUnique({ where: { guestToken }, select: { id: true } });
  if (!pending) return 0;

  return db.$transaction(async (tx) => {
    const guestCart = await tx.cart.findUnique({
      where: { guestToken },
      include: {
        items: {
          include: {
            variant: { select: { stockQty: true, reservedQty: true } },
          },
        },
      },
    });

    if (!guestCart) return 0;
    if (guestCart.items.length === 0) {
      await tx.cart.delete({ where: { id: guestCart.id } });
      return 0;
    }

    let userCart = await tx.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!userCart) {
      userCart = await tx.cart.create({
        data: { userId, currency: guestCart.currency },
        include: { items: true },
      });
    }

    const existingByKey = new Map(
      userCart.items.map((item) => [`${item.variantId}::${item.customizationConfigKey}`, item]),
    );
    let merged = 0;

    for (const gItem of guestCart.items) {
      const isCustomized = gItem.customizationConfigKey !== "";
      const available = isCustomized
        ? 1
        : Math.max(0, gItem.variant.stockQty - gItem.variant.reservedQty);
      if (available <= 0) continue;

      const key = `${gItem.variantId}::${gItem.customizationConfigKey}`;
      const existing = existingByKey.get(key);
      if (existing) {
        const nextQty = isCustomized
          ? 1
          : Math.min(10, available, existing.quantity + gItem.quantity);
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: nextQty },
        });
      } else {
        const safeQty = isCustomized ? 1 : Math.min(10, available, gItem.quantity);
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: gItem.variantId,
            customizationRequestId: gItem.customizationRequestId,
            customizationConfigKey: gItem.customizationConfigKey,
            customizationSnapshot: gItem.customizationSnapshot ?? Prisma.JsonNull,
            customUnitPriceBase: gItem.customUnitPriceBase,
            quantity: safeQty,
            unitPriceSnapshot: gItem.unitPriceSnapshot,
          },
        });
      }
      merged += 1;
    }

    await tx.cart.delete({ where: { id: guestCart.id } });
    return merged;
  });
}

export async function getCartForOwner(owner: CartOwner): Promise<CartSummaryDTO> {
  const [settings, cart] = await Promise.all([getPublicStoreSettings(), loadCartRows(owner)]);
  return mapCartToSummary(cart, settings.currency, settings.signatureThreshold);
}

export async function addCartItemForOwner(
  owner: CartOwner,
  variantId: string,
  quantity: number,
): Promise<CartSummaryDTO> {
  const ownerWhere =
    owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken };
  const [settings, variant, existingCart] = await Promise.all([
    getPublicStoreSettings(),
    db.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            status: true,
            deletedAt: true,
            priceMode: true,
            basePrice: true,
          },
        },
      },
    }),
    db.cart.findFirst({ where: ownerWhere }),
  ]);

  if (
    !variant ||
    !variant.isActive ||
    variant.product.status !== "ACTIVE" ||
    variant.product.deletedAt !== null
  ) {
    throw new NotFoundError("This piece or option is currently unavailable.");
  }

  if (variant.product.priceMode !== "FIXED") {
    throw new ValidationError(
      "This high-jewellery creation requires a private bespoke consultation rather than direct bag checkout.",
    );
  }

  const available = Math.max(0, variant.stockQty - variant.reservedQty);
  if (available <= 0) {
    throw new ConflictError("This option is currently out of stock.");
  }

  let cart = existingCart;

  if (!cart) {
    cart = await db.cart.create({
      data:
        owner.kind === "user"
          ? { userId: owner.userId, currency: settings.currency }
          : {
              guestToken: owner.guestToken,
              currency: settings.currency,
              expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            },
    });
  }

  const unitPrice = variant.priceOverride ?? variant.product.basePrice;
  const existingItem = await db.cartItem.findUnique({
    where: {
      cartId_variantId_customizationConfigKey: {
        cartId: cart.id,
        variantId,
        customizationConfigKey: "",
      },
    },
  });

  const nextQty = (existingItem?.quantity ?? 0) + quantity;
  if (nextQty > available) {
    throw new ConflictError(
      `Only ${available} piece${available === 1 ? "" : "s"} currently available in our vault.`,
    );
  }
  if (nextQty > 10) {
    throw new ValidationError("Maximum 10 units per piece in a single bag.");
  }

  if (existingItem) {
    await db.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: nextQty, unitPriceSnapshot: unitPrice },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        variantId,
        customizationConfigKey: "",
        quantity: nextQty,
        unitPriceSnapshot: unitPrice,
      },
    });
  }

  return getCartForOwner(owner);
}

export async function updateCartItemQtyForOwner(
  owner: CartOwner,
  variantId: string,
  quantity: number,
  cartItemId?: string,
): Promise<CartSummaryDTO> {
  const cart = await db.cart.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: { id: true },
  });
  if (!cart) {
    return getCartForOwner(owner);
  }

  const itemWhere: Prisma.CartItemWhereInput = cartItemId
    ? { cartId: cart.id, id: cartItemId }
    : { cartId: cart.id, variantId, customizationConfigKey: "" };

  if (quantity <= 0) {
    await db.cartItem.deleteMany({
      where: itemWhere,
    });
    return getCartForOwner(owner);
  }

  const existingTarget = await db.cartItem.findFirst({
    where: itemWhere,
    select: { id: true, customizationRequestId: true },
  });
  if (existingTarget?.customizationRequestId) {
    if (quantity > 1) {
      throw new ValidationError(
        "Bespoke quoted pieces are commissioned individually (quantity 1).",
      );
    }
    return getCartForOwner(owner);
  }

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { basePrice: true, status: true, deletedAt: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    throw new NotFoundError("This piece is no longer available.");
  }

  const available = Math.max(0, variant.stockQty - variant.reservedQty);
  if (quantity > available) {
    throw new ConflictError(
      `Only ${available} piece${available === 1 ? "" : "s"} currently available.`,
    );
  }

  await db.cartItem.updateMany({
    where: itemWhere,
    data: {
      quantity,
      unitPriceSnapshot: variant.priceOverride ?? variant.product.basePrice,
    },
  });

  return getCartForOwner(owner);
}

export async function resolveCurrentCartOwner(
  createGuestIfMissing = false,
): Promise<CartOwner | null> {
  const [session, guestToken] = await Promise.all([
    getOptionalSession(),
    readGuestTokenFromCookies(),
  ]);

  if (session?.user) {
    if (guestToken) {
      await mergeGuestCartToUser(guestToken, session.user.id);
    }
    return { kind: "user", userId: session.user.id };
  }

  if (guestToken) {
    return { kind: "guest", guestToken };
  }

  if (createGuestIfMissing) {
    const created = await getOrCreateGuestTokenCookie();
    return { kind: "guest", guestToken: created };
  }

  return null;
}

export const getCurrentCartSummary = cache(async (): Promise<CartSummaryDTO> => {
  const [settings, owner] = await Promise.all([
    getPublicStoreSettings(),
    resolveCurrentCartOwner(false),
  ]);
  if (!owner) {
    return {
      id: null,
      currency: settings.currency,
      itemCount: 0,
      subtotal: "0.00",
      items: [],
      signatureRequired: false,
    };
  }
  return getCartForOwner(owner);
});

export async function saveCartItemForLater(
  owner: CartOwner,
  variantId: string,
  cartItemId?: string,
) {
  const ownerWhere =
    owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken };
  return db.$transaction(async (tx) => {
    const [cart, existingWishlist] = await Promise.all([
      tx.cart.findFirst({ where: ownerWhere, select: { id: true } }),
      tx.wishlist.findFirst({ where: ownerWhere, select: { id: true } }),
    ]);

    const deleteCartItemPromise = cart
      ? tx.cartItem.deleteMany({
          where: cartItemId
            ? { cartId: cart.id, id: cartItemId }
            : { cartId: cart.id, variantId, customizationConfigKey: "" },
        })
      : Promise.resolve(null);

    const wishlist =
      existingWishlist ??
      (await tx.wishlist.create({
        data: ownerWhere,
        select: { id: true },
      }));

    const [, , wishlistRows] = await Promise.all([
      deleteCartItemPromise,
      tx.wishlistItem.createMany({
        data: [{ wishlistId: wishlist.id, variantId }],
        skipDuplicates: true,
      }),
      tx.wishlistItem.findMany({
        where: { wishlistId: wishlist.id },
        select: { variantId: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return wishlistRows.map((r) => r.variantId);
  });
}

export async function addCustomizedQuoteToBag(
  ownerInfo: { userId: string | null; guestToken: string | null },
  quote: {
    requestId: string;
    requestNumber: string;
    variantId: string;
    lockedPriceBase: string;
    selections: Array<{ groupLabel: string; displayValue: string }>;
  },
): Promise<CartSummaryDTO> {
  const settings = await getPublicStoreSettings();
  const owner: CartOwner = ownerInfo.userId
    ? { kind: "user", userId: ownerInfo.userId }
    : {
        kind: "guest",
        guestToken: ownerInfo.guestToken ?? (await getOrCreateGuestTokenCookie()),
      };

  let cart = await db.cart.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: { id: true },
  });
  if (!cart) {
    cart = await db.cart.create({
      data:
        owner.kind === "user"
          ? { userId: owner.userId, currency: settings.currency }
          : {
              guestToken: owner.guestToken,
              currency: settings.currency,
              expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            },
      select: { id: true },
    });
  }

  const lockedDec = toDecimal(quote.lockedPriceBase);
  const snapshotJson: Prisma.InputJsonValue = {
    requestNumber: quote.requestNumber,
    selections: quote.selections.map((s) => ({
      groupLabel: s.groupLabel,
      displayValue: s.displayValue,
    })),
  };

  await db.cartItem.upsert({
    where: {
      cartId_variantId_customizationConfigKey: {
        cartId: cart.id,
        variantId: quote.variantId,
        customizationConfigKey: quote.requestId,
      },
    },
    update: {
      quantity: 1,
      customizationRequestId: quote.requestId,
      customUnitPriceBase: lockedDec.toFixed(2),
      unitPriceSnapshot: lockedDec.toFixed(2),
      customizationSnapshot: snapshotJson,
    },
    create: {
      cartId: cart.id,
      variantId: quote.variantId,
      customizationRequestId: quote.requestId,
      customizationConfigKey: quote.requestId,
      customUnitPriceBase: lockedDec.toFixed(2),
      unitPriceSnapshot: lockedDec.toFixed(2),
      customizationSnapshot: snapshotJson,
      quantity: 1,
    },
  });

  return getCartForOwner(owner);
}
