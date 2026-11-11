import "server-only";
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
    phone: string | null;
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
      phone: true,
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
      phone: dbUser.phone,
      role: normalizeRole(dbUser.role),
    },
    sessionId: session.session.id,
  };
});

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
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return ctx;
}

export async function requireRole(minimumRole: UserRole): Promise<AuthenticatedContext> {
  const ctx = await requireUser();
  if (!roleAtLeast(ctx.user.role, minimumRole)) {
    throw new ForbiddenError("Your role does not have access to this resource.");
  }
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<AuthenticatedContext> {
  const ctx = await requireUser();
  if (!hasPermission(ctx.user.role, permission)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
  return ctx;
}
