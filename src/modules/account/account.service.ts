import "server-only";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import type { OrderStatus } from "@/generated/prisma/client";
import type { UserRole } from "@/lib/permissions";
import type {
  ChangePasswordInput,
  GuestOrderLookupInput,
  SaveAddressInput,
  UpdateProfileInput,
} from "@/modules/account/account.schemas";
import {
  addCartItemForOwner,
  type CartOwner,
  type CartSummaryDTO,
} from "@/modules/cart/cart.service";
import {
  createOrderTrackToken,
  hasValidGuestOrderAccess,
  loadProductSlugMap,
  mapOrderRecordToConfirmationDTO,
  type OrderConfirmationDTO,
  type SavedAddressDTO,
} from "@/modules/orders/order.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { deletePrivateMediaObject } from "@/server/private-media";

export interface CustomerOrderSummaryDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  currencyDecimals: number;
  baseCurrency: string;
  exchangeRate: string;
  total: string;
  baseTotal: string;
  itemCount: number;
  firstItemTitle: string;
  firstItemImage: string | null;
  itemThumbnails: Array<{
    title: string;
    imageUrl: string | null;
    quantity: number;
  }>;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
}

function mapCustomerOrderSummaryRow(o: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  currencyDecimals: number;
  baseCurrency: string;
  exchangeRate: { toFixed: (digits?: number) => string };
  total: { toFixed: (digits?: number) => string };
  baseTotal: { toFixed: (digits?: number) => string };
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: Date;
  items: Array<{
    titleSnapshot: string;
    imageUrlSnapshot: string | null;
    quantity: number;
  }>;
}): CustomerOrderSummaryDTO {
  const dp = o.currencyDecimals ?? 2;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    currency: o.currency,
    currencyDecimals: dp,
    baseCurrency: o.baseCurrency,
    exchangeRate: o.exchangeRate.toFixed(8),
    total: o.total.toFixed(dp),
    baseTotal: o.baseTotal.toFixed(2),
    itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    firstItemTitle: o.items[0]?.titleSnapshot ?? "Atelier Commission",
    firstItemImage: o.items[0]?.imageUrlSnapshot ?? null,
    itemThumbnails: o.items.slice(0, 3).map((item) => ({
      title: item.titleSnapshot,
      imageUrl: item.imageUrlSnapshot,
      quantity: item.quantity,
    })),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    createdAt: o.createdAt.toISOString(),
  };
}

export interface AccountProfileDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  hasPasswordAccount: boolean;
  createdAt: string;
}

export interface AccountOverviewDTO {
  profile: AccountProfileDTO;
  orderCount: number;
  addressCount: number;
  wishlistCount: number;
  recentOrders: CustomerOrderSummaryDTO[];
  defaultShippingAddress: SavedAddressDTO | null;
}

export interface GuestOrderTrackResultDTO {
  order: OrderConfirmationDTO;
  accessToken: string;
}

function mapAddressRow(row: {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}): SavedAddressDTO {
  return {
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    isDefaultShipping: row.isDefaultShipping,
    isDefaultBilling: row.isDefaultBilling,
  };
}

export async function getAccountProfile(userId: string): Promise<AccountProfileDTO> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
      accounts: {
        select: { providerId: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("Account record was not found.");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    hasPasswordAccount: user.accounts.some((a) => a.providerId === "credential"),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getAccountOverviewData(userId: string): Promise<AccountOverviewDTO> {
  const [profile, orderCount, addressCount, wishlistRow, recentOrdersRows, defaultAddressRow] =
    await Promise.all([
      getAccountProfile(userId),
      db.order.count({ where: { userId } }),
      db.address.count({ where: { userId } }),
      db.wishlist.findUnique({
        where: { userId },
        select: { _count: { select: { items: true } } },
      }),
      db.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          items: {
            select: {
              titleSnapshot: true,
              imageUrlSnapshot: true,
              quantity: true,
            },
          },
        },
      }),
      db.address.findFirst({
        where: { userId, isDefaultShipping: true },
      }),
    ]);

  return {
    profile,
    orderCount,
    addressCount,
    wishlistCount: wishlistRow?._count.items ?? 0,
    recentOrders: recentOrdersRows.map(mapCustomerOrderSummaryRow),
    defaultShippingAddress: defaultAddressRow ? mapAddressRow(defaultAddressRow) : null,
  };
}

export async function updateCustomerProfile(
  userId: string,
  input: UpdateProfileInput,
  requestHeaders?: Headers,
) {
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      phone: input.phone ?? null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });

  if (requestHeaders) {
    try {
      await auth.api.updateUser({
        headers: requestHeaders,
        body: {
          name: input.name,
        },
      });
    } catch {
      // Cookie cache refresh best-effort; DB already updated atomically.
    }
  }

  return updated;
}

export async function changeCustomerPassword(input: ChangePasswordInput, requestHeaders?: Headers) {
  const hdrs = requestHeaders ?? (await headers());
  try {
    await auth.api.changePassword({
      headers: hdrs,
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
    });
    return { updated: true };
  } catch (error) {
    if (error instanceof APIError) {
      throw new ValidationError(error.message || "Current password is incorrect.");
    }
    throw error;
  }
}

export async function listCustomerAddresses(userId: string): Promise<SavedAddressDTO[]> {
  const rows = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefaultShipping: "desc" }, { isDefaultBilling: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapAddressRow);
}

export const MAX_ADDRESSES_PER_USER = 10;

export async function getCustomerAddressForRest(
  userId: string,
  addressId: string,
): Promise<SavedAddressDTO> {
  const existing = await db.address.findUnique({ where: { id: addressId } });
  if (!existing) {
    throw new NotFoundError("Saved address was not found.");
  }
  if (existing.userId !== userId) {
    throw new ForbiddenError("You do not have permission to access this address.");
  }
  return mapAddressRow(existing);
}

export async function saveCustomerAddress(
  userId: string,
  input: SaveAddressInput,
): Promise<SavedAddressDTO> {
  return db.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });

    if (input.id) {
      const existing = await tx.address.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new NotFoundError("Saved address was not found.");
      }
      if (existing.userId !== userId) {
        throw new ForbiddenError("You do not have permission to modify this address.");
      }

      const fallbackOther =
        existingCount > 1
          ? await tx.address.findFirst({
              where: { userId, id: { not: existing.id } },
              orderBy: { createdAt: "desc" },
            })
          : null;

      // Preserve invariant: user with >= 1 address always retains one default shipping & billing address.
      let nextDefaultShipping = Boolean(input.isDefaultShipping);
      if (existing.isDefaultShipping && !nextDefaultShipping) {
        if (fallbackOther) {
          await tx.address.update({
            where: { id: fallbackOther.id },
            data: { isDefaultShipping: true },
          });
        } else {
          nextDefaultShipping = true;
        }
      }

      let nextDefaultBilling = Boolean(input.isDefaultBilling);
      if (existing.isDefaultBilling && !nextDefaultBilling) {
        if (fallbackOther) {
          await tx.address.update({
            where: { id: fallbackOther.id },
            data: { isDefaultBilling: true },
          });
        } else {
          nextDefaultBilling = true;
        }
      }

      if (nextDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true, id: { not: existing.id } },
          data: { isDefaultShipping: false },
        });
      }
      if (nextDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true, id: { not: existing.id } },
          data: { isDefaultBilling: false },
        });
      }

      const updated = await tx.address.update({
        where: { id: existing.id },
        data: {
          label: input.label ?? null,
          fullName: input.fullName,
          phone: input.phone,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          isDefaultShipping: nextDefaultShipping,
          isDefaultBilling: nextDefaultBilling,
        },
      });
      return mapAddressRow(updated);
    }

    if (existingCount >= MAX_ADDRESSES_PER_USER) {
      throw new ValidationError(
        `You can save up to ${MAX_ADDRESSES_PER_USER} addresses. Remove an existing address before adding another.`,
      );
    }

    const makeDefaultShipping = Boolean(input.isDefaultShipping) || existingCount === 0;
    const makeDefaultBilling = Boolean(input.isDefaultBilling) || existingCount === 0;

    if (makeDefaultShipping) {
      await tx.address.updateMany({
        where: { userId, isDefaultShipping: true },
        data: { isDefaultShipping: false },
      });
    }
    if (makeDefaultBilling) {
      await tx.address.updateMany({
        where: { userId, isDefaultBilling: true },
        data: { isDefaultBilling: false },
      });
    }

    const created = await tx.address.create({
      data: {
        userId,
        label: input.label ?? null,
        fullName: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        isDefaultShipping: makeDefaultShipping,
        isDefaultBilling: makeDefaultBilling,
      },
    });
    return mapAddressRow(created);
  });
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  await db.$transaction(async (tx) => {
    const target = await tx.address.findUnique({
      where: { id: addressId },
    });
    if (!target) {
      throw new NotFoundError("Address was not found.");
    }
    if (target.userId !== userId) {
      throw new ForbiddenError("You do not have permission to delete this address.");
    }

    await tx.address.delete({ where: { id: target.id } });

    if (target.isDefaultShipping || target.isDefaultBilling) {
      const fallback = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (fallback) {
        await tx.address.update({
          where: { id: fallback.id },
          data: {
            ...(target.isDefaultShipping ? { isDefaultShipping: true } : {}),
            ...(target.isDefaultBilling ? { isDefaultBilling: true } : {}),
          },
        });
      }
    }
  });

  return { deletedId: addressId };
}

export async function setDefaultCustomerAddress(
  userId: string,
  addressId: string,
  kind: "shipping" | "billing",
): Promise<SavedAddressDTO> {
  return db.$transaction(async (tx) => {
    const target = await tx.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!target) {
      throw new NotFoundError("Address was not found.");
    }

    if (kind === "shipping") {
      await tx.address.updateMany({
        where: { userId, isDefaultShipping: true },
        data: { isDefaultShipping: false },
      });
      const updated = await tx.address.update({
        where: { id: target.id },
        data: { isDefaultShipping: true },
      });
      return mapAddressRow(updated);
    }

    await tx.address.updateMany({
      where: { userId, isDefaultBilling: true },
      data: { isDefaultBilling: false },
    });
    const updated = await tx.address.update({
      where: { id: target.id },
      data: { isDefaultBilling: true },
    });
    return mapAddressRow(updated);
  });
}

export async function listCustomerOrders(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<{
  orders: CustomerOrderSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, params?.pageSize ?? 10));

  const [total, rows] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: {
          select: {
            titleSnapshot: true,
            imageUrlSnapshot: true,
            quantity: true,
          },
        },
      },
    }),
  ]);

  return {
    orders: rows.map(mapCustomerOrderSummaryRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerOrderDetail(
  userId: string,
  orderNumber: string,
): Promise<OrderConfirmationDTO> {
  const [settings, order] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findFirst({
      where: {
        orderNumber,
        userId,
      },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!order) {
    throw new NotFoundError("Order record was not found in your account.");
  }

  const slugMap = await loadProductSlugMap(order.items);
  return mapOrderRecordToConfirmationDTO(order, settings.contactEmail, slugMap);
}

/**
 * Fetches a single order by internal ID or order number with strict ownership enforcement
 * for customer REST API requests (throws 404 when missing, 403 when owned by another account).
 */
export async function getCustomerOrderByIdOrNumberForRest(
  userId: string,
  idOrOrderNumber: string,
): Promise<OrderConfirmationDTO> {
  const normalized = idOrOrderNumber.trim();
  const [settings, order] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: { equals: normalized, mode: "insensitive" } }],
      },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!order) {
    throw new NotFoundError("Order record was not found.");
  }

  if (!order.userId || order.userId !== userId) {
    throw new ForbiddenError("You do not have permission to view this order.");
  }

  const slugMap = await loadProductSlugMap(order.items);
  return mapOrderRecordToConfirmationDTO(order, settings.contactEmail, slugMap);
}

/**
 * Resolves an authorized order + store metadata for invoice PDF generation across
 * account owners, staff reviewers, and signed guest lookup tokens.
 */
export async function getOrderForInvoiceDownload(params: {
  idOrOrderNumber: string;
  userId?: string | null;
  userRole?: string | null;
  guestToken?: string | null;
}): Promise<{ order: OrderConfirmationDTO; storeName: string }> {
  const normalized = params.idOrOrderNumber.trim();
  const [settings, order] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findFirst({
      where: {
        OR: [{ id: normalized }, { orderNumber: { equals: normalized, mode: "insensitive" } }],
      },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!order) {
    throw new NotFoundError("Order record was not found.");
  }

  const isOwner = Boolean(params.userId && order.userId && order.userId === params.userId);
  const isStaff = params.userRole === "ADMIN" || params.userRole === "STAFF";
  const hasValidToken = hasValidGuestOrderAccess(
    order.orderNumber,
    params.guestToken,
    order.guestLookupTokenHash,
  );

  if (!isOwner && !isStaff && !hasValidToken) {
    throw new ForbiddenError("You do not have permission to download this invoice.");
  }

  const slugMap = await loadProductSlugMap(order.items);
  return {
    order: mapOrderRecordToConfirmationDTO(order, settings.contactEmail, slugMap),
    storeName: settings.storeName,
  };
}

/**
 * Re-adds available stocked items from a past order into the caller's shopping bag.
 */
export async function reorderCustomerOrder(params: {
  orderNumber: string;
  guestToken?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  cartOwner: CartOwner;
}): Promise<{
  cart: CartSummaryDTO;
  addedCount: number;
  skippedItems: string[];
}> {
  const order = await db.order.findFirst({
    where: {
      orderNumber: { equals: params.orderNumber, mode: "insensitive" },
    },
    include: {
      items: {
        select: {
          variantId: true,
          titleSnapshot: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Order record was not found.");
  }

  const isOwner = Boolean(
    params.actorUserId && order.userId && order.userId === params.actorUserId,
  );
  const isStaff = params.actorRole === "ADMIN" || params.actorRole === "STAFF";
  const hasValidToken = hasValidGuestOrderAccess(
    order.orderNumber,
    params.guestToken,
    order.guestLookupTokenHash,
  );

  if (!isOwner && !isStaff && !hasValidToken) {
    throw new ForbiddenError(
      "Sign in to the purchasing account or use your order access link to reorder.",
    );
  }

  let latestCart: CartSummaryDTO | null = null;
  let addedCount = 0;
  const skippedItems: string[] = [];

  for (const item of order.items) {
    try {
      latestCart = await addCartItemForOwner(params.cartOwner, item.variantId, item.quantity);
      addedCount += 1;
    } catch {
      skippedItems.push(item.titleSnapshot);
    }
  }

  if (!latestCart || addedCount === 0) {
    throw new ValidationError(
      "None of the pieces from this order are currently available for immediate reorder.",
    );
  }

  return {
    cart: latestCart,
    addedCount,
    skippedItems,
  };
}

export async function anonymizeCustomerAccount(userId: string, confirmEmail: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      anonymizedAt: true,
    },
  });

  if (!user || user.anonymizedAt) {
    throw new NotFoundError("Account is already closed or missing.");
  }

  if (user.role === "ADMIN") {
    throw new ForbiddenError(
      "Administrator accounts cannot be self-deleted. Transfer your administrator role first.",
    );
  }

  if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
    throw new ValidationError("Confirmation email does not match your account email address.");
  }

  const anonymizedEmail = `deleted-${user.id}@anonymized.local`;

  const [custImages, chatAttachments] = await Promise.all([
    db.customizationRequestImage.findMany({
      where: { request: { userId } },
      select: { storageKey: true },
    }),
    db.chatAttachment.findMany({
      where: {
        OR: [{ uploaderId: userId }, { conversation: { userId } }],
      },
      select: { storageKey: true },
    }),
  ]);

  await db.$transaction(async (tx) => {
    const now = new Date();
    await Promise.all([
      tx.session.deleteMany({ where: { userId } }),
      tx.account.deleteMany({ where: { userId } }),
      tx.twoFactor.deleteMany({ where: { userId } }),
      tx.address.deleteMany({ where: { userId } }),
      tx.wishlist.deleteMany({ where: { userId } }),
      tx.cart.deleteMany({ where: { userId } }),
      tx.newsletterSubscriber.updateMany({
        where: { email: user.email.toLowerCase() },
        data: {
          status: "UNSUBSCRIBED",
          unsubscribedAt: now,
          confirmTokenHash: null,
          confirmTokenExpiresAt: null,
        },
      }),
      tx.enquiry.updateMany({
        where: { userId },
        data: {
          name: "Anonymized Client",
          email: anonymizedEmail,
          phone: null,
        },
      }),
      tx.customizationRequestImage.deleteMany({
        where: { request: { userId } },
      }),
      tx.chatAttachment.deleteMany({
        where: {
          OR: [{ uploaderId: userId }, { conversation: { userId } }],
        },
      }),
      tx.message.updateMany({
        where: { conversation: { userId }, senderRole: "CUSTOMER" },
        data: {
          senderName: "Anonymized Client",
          body: "[Removed on account closure]",
        },
      }),
    ]);

    await Promise.all([
      tx.customizationRequest.updateMany({
        where: { userId },
        data: {
          customerName: "Anonymized Client",
          customerEmail: anonymizedEmail,
          customerPhone: null,
          customerNote: null,
        },
      }),
      tx.conversation.updateMany({
        where: { userId },
        data: {
          guestName: "Anonymized Client",
          guestEmail: anonymizedEmail,
          status: "CLOSED",
          lastMessagePreview: null,
        },
      }),
    ]);

    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Anonymized Client",
        email: anonymizedEmail,
        phone: null,
        image: null,
        emailVerified: false,
        twoFactorEnabled: false,
        banned: true,
        banReason: "Client requested GDPR account deletion",
        anonymizedAt: now,
      },
    });
  });

  const keysToRemove = [
    ...custImages.map((img) => img.storageKey),
    ...chatAttachments.map((att) => att.storageKey),
  ];
  await Promise.allSettled(keysToRemove.map((key) => deletePrivateMediaObject(key)));

  return { deleted: true };
}

export interface CustomerPersonalDataExport {
  exportedAt: string;
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    createdAt: string;
  };
  addresses: SavedAddressDTO[];
  orders: Array<{
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    subtotal: string;
    shippingCost: string;
    taxAmount: string;
    total: string;
    shippingAddress: unknown;
    billingAddress: unknown;
    trackingNumber: string | null;
    carrier: string | null;
    createdAt: string;
    items: Array<{
      sku: string;
      title: string;
      variantTitle: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
  }>;
  wishlist: Array<{
    addedAt: string;
    variantSku: string;
    variantTitle: string;
    productName: string;
    productSlug: string;
  }>;
  enquiries: Array<{
    id: string;
    type: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
  customizationRequests: Array<{
    requestNumber: string;
    status: string;
    productName: string;
    customerNote: string | null;
    quotedPriceBase: string | null;
    selections: unknown;
    createdAt: string;
  }>;
  conversations: Array<{
    id: string;
    contextType: string;
    status: string;
    createdAt: string;
    messages: Array<{
      senderRole: string;
      senderName: string;
      type: string;
      body: string;
      createdAt: string;
    }>;
  }>;
}

/**
 * Generates a GDPR personal data export scoped strictly to the authenticated userId.
 */
export async function exportCustomerPersonalData(
  userId: string,
): Promise<CustomerPersonalDataExport> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      twoFactorEnabled: true,
      anonymizedAt: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
      wishlist: {
        include: {
          items: {
            orderBy: { createdAt: "desc" },
            include: {
              variant: {
                select: {
                  sku: true,
                  title: true,
                  product: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
      },
      enquiries: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          message: true,
          createdAt: true,
        },
      },
      customizationRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { name: true } },
          item: { select: { selections: true } },
        },
      },
      conversations: {
        orderBy: { createdAt: "desc" },
        include: {
          messages: {
            orderBy: { seq: "asc" },
            select: {
              senderRole: true,
              senderName: true,
              type: true,
              body: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.anonymizedAt) {
    throw new NotFoundError("Account record was not found.");
  }

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
    },
    addresses: user.addresses.map(mapAddressRow),
    orders: user.orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal.toFixed(2),
      shippingCost: order.shippingCost.toFixed(2),
      taxAmount: order.taxAmount.toFixed(2),
      total: order.total.toFixed(2),
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        sku: item.skuSnapshot,
        title: item.titleSnapshot,
        variantTitle: item.variantTitleSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      })),
    })),
    wishlist:
      user.wishlist?.items.map((w) => ({
        addedAt: w.createdAt.toISOString(),
        variantSku: w.variant.sku,
        variantTitle: w.variant.title,
        productName: w.variant.product.name,
        productSlug: w.variant.product.slug,
      })) ?? [],
    enquiries: user.enquiries.map((e) => ({
      id: e.id,
      type: e.type,
      status: e.status,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    customizationRequests: user.customizationRequests.map((reqRow) => ({
      requestNumber: reqRow.requestNumber,
      status: reqRow.status,
      productName: reqRow.product.name,
      customerNote: reqRow.customerNote,
      quotedPriceBase: reqRow.quotedPriceBase ? reqRow.quotedPriceBase.toFixed(2) : null,
      selections: reqRow.item?.selections ?? [],
      createdAt: reqRow.createdAt.toISOString(),
    })),
    conversations: user.conversations.map((conv) => ({
      id: conv.id,
      contextType: conv.contextType,
      status: conv.status,
      createdAt: conv.createdAt.toISOString(),
      messages: conv.messages.map((m) => ({
        senderRole: m.senderRole,
        senderName: m.senderName,
        type: m.type,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    })),
  };
}

export async function verifyGuestOrderLookup(
  input: GuestOrderLookupInput,
): Promise<GuestOrderTrackResultDTO> {
  const [settings, order] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findFirst({
      where: {
        orderNumber: { equals: input.orderNumber, mode: "insensitive" },
      },
      include: {
        user: { select: { email: true, anonymizedAt: true } },
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const genericMessage = "We could not verify an order matching that order number and email.";

  if (!order) {
    throw new NotFoundError(genericMessage);
  }

  const candidateEmails = [
    order.guestEmail?.toLowerCase(),
    order.user && !order.user.anonymizedAt ? order.user.email.toLowerCase() : undefined,
  ].filter(Boolean) as string[];

  if (!candidateEmails.includes(input.email.toLowerCase())) {
    throw new NotFoundError(genericMessage);
  }

  const slugMap = await loadProductSlugMap(order.items);
  return {
    order: mapOrderRecordToConfirmationDTO(order, settings.contactEmail, slugMap),
    accessToken: createOrderTrackToken(order.orderNumber),
  };
}
