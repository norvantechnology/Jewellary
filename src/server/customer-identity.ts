import "server-only";
import { hasPermission, type UserRole } from "@/lib/permissions";
import { getOptionalSession } from "@/server/dal";
import { ForbiddenError } from "@/server/errors";
import { getOrCreateGuestTokenCookie, readGuestTokenFromCookies } from "@/server/guest-token";

export interface ActorIdentity {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  role: UserRole | null;
  guestToken: string | null;
  primaryOwnerKey: string;
  allOwnerKeys: string[];
  isStaff: boolean;
}

export async function resolveActorIdentity(options?: {
  createGuestCookie?: boolean;
}): Promise<ActorIdentity> {
  const [session, existingGuest] = await Promise.all([
    getOptionalSession(),
    readGuestTokenFromCookies(),
  ]);

  let guestToken = existingGuest;
  if (!session && !guestToken && options?.createGuestCookie) {
    guestToken = await getOrCreateGuestTokenCookie();
  }

  const allOwnerKeys: string[] = [];
  if (session?.user.id) {
    allOwnerKeys.push(`user:${session.user.id}`);
  }
  if (guestToken) {
    allOwnerKeys.push(`guest:${guestToken}`);
  }

  const primaryOwnerKey = allOwnerKeys[0] ?? "anonymous";
  const role = session?.user.role ?? null;
  const isStaff = Boolean(role && hasPermission(role, "admin:dashboard"));

  return {
    userId: session?.user.id ?? null,
    userEmail: session?.user.email ?? null,
    userName: session?.user.name ?? null,
    role,
    guestToken,
    primaryOwnerKey,
    allOwnerKeys,
    isStaff,
  };
}

export function assertCustomerOrGuestOwnership(
  actor: ActorIdentity,
  record: { userId: string | null; guestToken: string | null },
  staffPermission: "customization:manage" | "chat:manage",
): void {
  if (actor.role && hasPermission(actor.role, staffPermission)) {
    return;
  }
  if (actor.userId && record.userId && actor.userId === record.userId) {
    return;
  }
  if (actor.guestToken && record.guestToken && actor.guestToken === record.guestToken) {
    return;
  }
  throw new ForbiddenError("You do not have permission to access this resource.");
}
