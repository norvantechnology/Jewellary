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
  createOrderTrackToken,
  mapOrderRecordToConfirmationDTO,
  type OrderConfirmationDTO,
  type SavedAddressDTO,
} from "@/modules/orders/order.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";

export interface CustomerOrderSummaryDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  total: string;
  itemCount: number;
  firstItemTitle: string;
  firstItemImage: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
}

export interface AccountProfileDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
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
    recentOrders: recentOrdersRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      currency: o.currency,
      total: o.total.toFixed(2),
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      firstItemTitle: o.items[0]?.titleSnapshot ?? "Atelier Commission",
      firstItemImage: o.items[0]?.imageUrlSnapshot ?? null,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      trackingUrl: o.trackingUrl,
      createdAt: o.createdAt.toISOString(),
    })),
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
        revokeOtherSessions: false,
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

export async function saveCustomerAddress(
  userId: string,
  input: SaveAddressInput,
): Promise<SavedAddressDTO> {
  return db.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    const makeDefaultShipping =
      Boolean(input.isDefaultShipping) || (existingCount === 0 && !input.id);
    const makeDefaultBilling =
      Boolean(input.isDefaultBilling) || (existingCount === 0 && !input.id);

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

    if (input.id) {
      const existing = await tx.address.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new NotFoundError("Saved address was not found.");
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
          isDefaultShipping: makeDefaultShipping,
          isDefaultBilling: makeDefaultBilling,
        },
      });
      return mapAddressRow(updated);
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
    const target = await tx.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!target) {
      throw new NotFoundError("Address was not found.");
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
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      currency: o.currency,
      total: o.total.toFixed(2),
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      firstItemTitle: o.items[0]?.titleSnapshot ?? "Atelier Commission",
      firstItemImage: o.items[0]?.imageUrlSnapshot ?? null,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      trackingUrl: o.trackingUrl,
      createdAt: o.createdAt.toISOString(),
    })),
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

  return mapOrderRecordToConfirmationDTO(order, settings.contactEmail);
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

  await db.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.wishlist.deleteMany({ where: { userId } });
    await tx.cart.deleteMany({ where: { userId } });

    await tx.newsletterSubscriber.updateMany({
      where: { email: user.email.toLowerCase() },
      data: {
        unsubscribedAt: new Date(),
      },
    });

    await tx.enquiry.updateMany({
      where: { userId },
      data: {
        name: "Anonymized Client",
        email: anonymizedEmail,
        phone: null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Anonymized Client",
        email: anonymizedEmail,
        phone: null,
        image: null,
        emailVerified: false,
        banned: true,
        banReason: "Client requested GDPR account deletion",
        anonymizedAt: new Date(),
      },
    });
  });

  return { deleted: true };
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

  return {
    order: mapOrderRecordToConfirmationDTO(order, settings.contactEmail),
    accessToken: createOrderTrackToken(order.orderNumber),
  };
}
