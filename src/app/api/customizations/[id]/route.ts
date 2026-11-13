import { NextResponse } from "next/server";
import { getCustomizationRequestDetailForActor } from "@/modules/customization/customization.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const detail = await getCustomizationRequestDetailForActor(id, actor);
    return NextResponse.json({ request: detail });
  } catch (err) {
    return jsonApiError(err);
  }
}
