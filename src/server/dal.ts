import "server-only";
import { getRequestReturnTo } from "@/server/return-to";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission, roleAtLeast, type Permission, type UserRole } from "@/lib/permissions";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

export interface AuthenticatedContext {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    phone: string | null;
    preferredCurrency?: string | null;
    role: UserRole;
  };
  sessionId: string;
}

function normalizeRole(role: string | null | undefined): UserRole {
  if (role === "ADMIN" || role === "STAFF" || role === "CUSTOMER") {
    return role;
  }
  return "CUSTOMER";
}

export const getOptionalSession = cache(async (): Promise<AuthenticatedContext | null> => {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  if (!cookieHeader.includes("session_token=") && !hdrs.get("authorization")) {
    return null;
  }
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user?.id || !session?.session?.id) {
    return null;
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      twoFactorEnabled: true,
      phone: true,
      preferredCurrency: true,
      role: true,
      banned: true,
      banExpires: true,
      anonymizedAt: true,
    },
  });

  if (!dbUser || dbUser.anonymizedAt) {
    return null;
  }

  if (dbUser.banned && (!dbUser.banExpires || dbUser.banExpires > new Date())) {
    return null;
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      emailVerified: dbUser.emailVerified,
      twoFactorEnabled: dbUser.twoFactorEnabled,
      phone: dbUser.phone,
      preferredCurrency: dbUser.preferredCurrency ?? null,
      role: normalizeRole(dbUser.role),
    },
    sessionId: session.session.id,
  };
});

const getRequireAdminTwoFactor = cache(async (): Promise<boolean> => {
  const setting = await db.storeSetting.findUnique({
    where: { id: "default" },
    select: { requireAdminTwoFactor: true },
  });
  return Boolean(setting?.requireAdminTwoFactor);
});

/**
 * Checks whether Store Settings enforce two-factor authentication for staff & admins
 * and whether the authenticated user still needs to enrol TOTP.
 */
export async function requiresStaffTwoFactorSetup(user: {
  role: UserRole;
  twoFactorEnabled: boolean;
}): Promise<boolean> {
  if (!roleAtLeast(user.role, "STAFF") || user.twoFactorEnabled) {
    return false;
  }
  return getRequireAdminTwoFactor();
}

/**
 * Page-level guard for Admin Studio routes: requires at least STAFF role and redirects
 * staff/admin users without 2FA to security setup when mandated by Store Settings.
 */
export async function requireStaffPageSession(
  nextPath = "/admin",
): Promise<AuthenticatedContext | null> {
  const ctx = await getOptionalSession();
  if (!ctx) {
    redirect(`/login?next=${encodeURIComponent(await getRequestReturnTo(nextPath))}`);
  }
  if (!roleAtLeast(ctx.user.role, "STAFF")) {
    return null;
  }
  if (await requiresStaffTwoFactorSetup(ctx.user)) {
    redirect("/account/settings?setup2fa=1#two-factor");
  }
  return ctx;
}

export async function requireUser(): Promise<AuthenticatedContext> {
  const ctx = await getOptionalSession();
  if (!ctx) {
    throw new UnauthorizedError("Authentication is required.");
  }
  return ctx;
}

/**
 * Page-level session guard that performs a clean Next.js redirect when
 * unauthenticated instead of throwing during parallel RSC layout/page renders
 * or background `<Link>` prefetches.
 */
export async function requirePageUser(nextPath = "/account"): Promise<AuthenticatedContext> {
  const ctx = await getOptionalSession();
  if (!ctx) {
    redirect(`/login?next=${encodeURIComponent(await getRequestReturnTo(nextPath))}`);
  }
  return ctx;
}

export async function requireRole(minimumRole: UserRole): Promise<AuthenticatedContext> {
  const ctx = await requireUser();
  if (!roleAtLeast(ctx.user.role, minimumRole)) {
    throw new ForbiddenError("Your role does not have access to this resource.");
  }
  if (roleAtLeast(minimumRole, "STAFF") && (await requiresStaffTwoFactorSetup(ctx.user))) {
    throw new ForbiddenError(
      "Two-factor authentication setup is required for staff access. Configure 2FA in Account Settings.",
    );
  }
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<AuthenticatedContext> {
  const ctx = await requireUser();
  if (!hasPermission(ctx.user.role, permission)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
  if (roleAtLeast(ctx.user.role, "STAFF") && (await requiresStaffTwoFactorSetup(ctx.user))) {
    throw new ForbiddenError(
      "Two-factor authentication setup is required for staff access. Configure 2FA in Account Settings.",
    );
  }
  return ctx;
}
