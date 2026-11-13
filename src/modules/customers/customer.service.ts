import "server-only";
import { Prisma, type OrderStatus, type UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import type { ChangeCustomerRoleInput } from "@/modules/customers/customer.schemas";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { writeAuditLog } from "@/server/audit";
import type { AuthenticatedContext } from "@/server/dal";
import { db } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";

export interface AdminCustomerListItemDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
  banned: boolean;
  anonymized: boolean;
  orderCount: number;
  lifetimeSpend: string;
  currency: string;
  lastOrderAt: string | null;
  createdAt: string;
  piiMasked: boolean;
}

export interface AdminCustomerDetailDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  emailVerified: boolean;
  banned: boolean;
  anonymizedAt: string | null;
  createdAt: string;
  orderCount: number;
  enquiryCount: number;
  lifetimeSpend: string;
  currency: string;
  piiMasked: boolean;
  addresses: Array<{
    id: string;
    label: string | null;
    fullName: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    total: string;
    createdAt: string;
  }>;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)} •••• ${trimmed.slice(-2)}`;
}

function maskStreet(line: string): string {
  if (!line) return "••••";
  return "•••••• (Protected PII)";
}

export async function listAdminCustomers(
  params: {
    page?: number;
    pageSize?: number;
    q?: string;
    role?: UserRole | "ALL";
  },
  actor: AuthenticatedContext,
): Promise<{
  customers: AdminCustomerListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  piiMasked: boolean;
}> {
  if (!hasPermission(actor.user.role, "customers:read")) {
    throw new ForbiddenError(
      "Customer directory access requires staff or administrator permissions.",
    );
  }

  const canReadFullPii = hasPermission(actor.user.role, "customers:read_full_pii");
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const q = params.q?.trim();

  const where: Prisma.UserWhereInput = {
    ...(params.role && params.role !== "ALL" ? { role: params.role } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [settings, total, users] = await Promise.all([
    getPublicStoreSettings(),
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        banned: true,
        anonymizedAt: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
    }),
  ]);

  const userIds = users.map((u) => u.id);
  const spendRows =
    userIds.length > 0
      ? await db.$queryRaw<
          Array<{ userId: string; spend: number; lastOrderAt: Date | null }>
        >(Prisma.sql`
          SELECT
            "userId",
            COALESCE(SUM(GREATEST(0, "total" - "refundedAmount")), 0)::float8 AS spend,
            MAX("createdAt") AS "lastOrderAt"
          FROM "Order"
          WHERE "userId" IN (${Prisma.join(userIds)})
            AND "status" NOT IN ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED')
          GROUP BY "userId"
        `)
      : [];
  const spendByUser = new Map(spendRows.map((r) => [r.userId, r]));

  return {
    customers: users.map((u) => {
      const agg = spendByUser.get(u.id);
      const spend = Number(agg?.spend ?? 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: canReadFullPii ? u.phone : maskPhone(u.phone),
        role: u.role,
        emailVerified: u.emailVerified,
        banned: Boolean(u.banned),
        anonymized: Boolean(u.anonymizedAt),
        orderCount: u._count.orders,
        lifetimeSpend: spend.toFixed(2),
        currency: settings.currency,
        lastOrderAt: agg?.lastOrderAt ? new Date(agg.lastOrderAt).toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        piiMasked: !canReadFullPii,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    piiMasked: !canReadFullPii,
  };
}

export async function getAdminCustomerDetail(
  customerId: string,
  actor: AuthenticatedContext,
): Promise<AdminCustomerDetailDTO> {
  if (!hasPermission(actor.user.role, "customers:read")) {
    throw new ForbiddenError(
      "Customer directory access requires staff or administrator permissions.",
    );
  }

  const canReadFullPii = hasPermission(actor.user.role, "customers:read_full_pii");

  const [settings, user, spendAgg] = await Promise.all([
    getPublicStoreSettings(),
    db.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        banned: true,
        anonymizedAt: true,
        createdAt: true,
        addresses: {
          orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            label: true,
            fullName: true,
            phone: true,
            line1: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            isDefaultShipping: true,
            isDefaultBilling: true,
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: true,
            total: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            enquiries: true,
          },
        },
      },
    }),
    db.$queryRaw<Array<{ spend: number }>>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(0, "total" - "refundedAmount")), 0)::float8 AS spend
      FROM "Order"
      WHERE "userId" = ${customerId}
        AND "status" NOT IN ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED')
    `),
  ]);

  if (!user) {
    throw new NotFoundError("Customer account not found.");
  }

  const lifetimeSpend = Number(spendAgg[0]?.spend ?? 0);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: canReadFullPii ? user.phone : maskPhone(user.phone),
    role: user.role,
    emailVerified: user.emailVerified,
    banned: Boolean(user.banned),
    anonymizedAt: user.anonymizedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    orderCount: user._count.orders,
    enquiryCount: user._count.enquiries,
    lifetimeSpend: lifetimeSpend.toFixed(2),
    currency: settings.currency,
    piiMasked: !canReadFullPii,
    addresses: user.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      fullName: a.fullName,
      phone: canReadFullPii ? a.phone : (maskPhone(a.phone) ?? "••••"),
      line1: canReadFullPii ? a.line1 : maskStreet(a.line1),
      city: a.city,
      state: a.state,
      postalCode: canReadFullPii ? a.postalCode : "••••",
      country: a.country,
      isDefaultShipping: a.isDefaultShipping,
      isDefaultBilling: a.isDefaultBilling,
    })),
    orders: user.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      currency: o.currency,
      total: o.total.toFixed(2),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function changeCustomerRole(
  input: ChangeCustomerRoleInput,
  actor: AuthenticatedContext,
) {
  if (!hasPermission(actor.user.role, "customers:change_role")) {
    throw new ForbiddenError("Only administrators can modify account roles.");
  }

  const target = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      banned: true,
      anonymizedAt: true,
    },
  });

  if (!target || target.anonymizedAt) {
    throw new NotFoundError("Target user account was not found.");
  }

  if (target.id === actor.user.id && input.role !== "ADMIN") {
    throw new ForbiddenError("You cannot demote your own administrator role.");
  }

  if (target.role === "ADMIN" && input.role !== "ADMIN") {
    const activeAdmins = await db.user.count({
      where: {
        role: "ADMIN",
        banned: false,
        anonymizedAt: null,
      },
    });
    if (activeAdmins <= 1) {
      throw new ConflictError("At least one active administrator account must remain.");
    }
  }

  const updated = await db.user.update({
    where: { id: target.id },
    data: { role: input.role },
    select: { id: true, role: true },
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: "user.role_changed",
    entityType: "User",
    entityId: target.id,
    before: { role: target.role, email: target.email },
    after: { role: updated.role, reason: input.reason ?? null },
  });

  return updated;
}
