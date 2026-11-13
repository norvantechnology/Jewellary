import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { resolveActorIdentity } from "@/server/customer-identity";
import { jsonApiError } from "@/server/private-media-http";

export async function GET() {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const canManageChat = Boolean(actor.role && hasPermission(actor.role, "chat:manage"));
    return NextResponse.json({
      ok: true,
      data: {
        authenticated: Boolean(actor.userId || actor.guestToken),
        userId: actor.userId,
        userName: actor.userName ?? "Guest",
        userEmail: actor.userEmail ?? null,
        role: actor.role,
        isStaff: canManageChat,
        guestToken: actor.guestToken,
        targetKeys: actor.allOwnerKeys,
      },
    });
  } catch (err) {
    return jsonApiError(err);
  }
}
