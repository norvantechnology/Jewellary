import "server-only";
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
  for (const row of cart.items) {
    const product = row.variant.product;
    if (
      product.status !== "ACTIVE" ||
      product.deletedAt !== null ||
      !row.variant.isActive ||
      product.priceMode !== "FIXED"
    ) {
      continue;
    }

    const liveUnitPrice = toDecimal((row.variant.priceOverride ?? product.basePrice).toString());
    const snapshotPrice = toDecimal(row.unitPriceSnapshot.toString());
    const availableStock = Math.max(0, row.variant.stockQty - row.variant.reservedQty);
    const hasStockIssue = availableStock < row.quantity;
    const effectiveQty = availableStock > 0 ? Math.min(row.quantity, availableStock) : 0;
    const lineTotal = multiplyMoney(liveUnitPrice, effectiveQty);

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

    const existingByVariant = new Map(userCart.items.map((item) => [item.variantId, item]));
    let merged = 0;

    for (const gItem of guestCart.items) {
      const available = Math.max(0, gItem.variant.stockQty - gItem.variant.reservedQty);
      if (available <= 0) continue;

      const existing = existingByVariant.get(gItem.variantId);
      if (existing) {
        const nextQty = Math.min(10, available, existing.quantity + gItem.quantity);
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: nextQty },
        });
      } else {
        const safeQty = Math.min(10, available, gItem.quantity);
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: gItem.variantId,
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
  const settings = await getPublicStoreSettings();
  const variant = await db.productVariant.findUnique({
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
  });

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

  let cart = await db.cart.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
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
    });
  }

  const unitPrice = variant.priceOverride ?? variant.product.basePrice;
  const existingItem = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
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
): Promise<CartSummaryDTO> {
  const cart = await db.cart.findFirst({
    where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
    select: { id: true },
  });
  if (!cart) {
    return getCartForOwner(owner);
  }

  if (quantity <= 0) {
    await db.cartItem.deleteMany({
      where: { cartId: cart.id, variantId },
    });
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
    where: { cartId: cart.id, variantId },
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
  const session = await getOptionalSession();
  const guestToken = await readGuestTokenFromCookies();

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

export async function getCurrentCartSummary(): Promise<CartSummaryDTO> {
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
}

export async function saveCartItemForLater(owner: CartOwner, variantId: string) {
  return db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
      select: { id: true },
    });

    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    }

    let wishlist = await tx.wishlist.findFirst({
      where: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
      select: { id: true },
    });

    if (!wishlist) {
      wishlist = await tx.wishlist.create({
        data: owner.kind === "user" ? { userId: owner.userId } : { guestToken: owner.guestToken },
        select: { id: true },
      });
    }

    await tx.wishlistItem.createMany({
      data: [{ wishlistId: wishlist.id, variantId }],
      skipDuplicates: true,
    });

    const wishlistRows = await tx.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      select: { variantId: true },
      orderBy: { createdAt: "desc" },
    });

    return wishlistRows.map((r) => r.variantId);
  });
}
