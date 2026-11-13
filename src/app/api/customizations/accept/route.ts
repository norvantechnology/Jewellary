import { NextResponse } from "next/server";
import { acceptQuoteAsOrderSchema } from "@/modules/customization/customization.schemas";
import { consumeQuoteTokenAndAddToBag } from "@/modules/customization/customization.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function POST(req: Request) {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const body = await req.json().catch(() => null);
    const parsed = acceptQuoteAsOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Invalid quote acceptance input.",
      );
    }
    const cart = await consumeQuoteTokenAndAddToBag(parsed.data, actor);
    return NextResponse.json({ cart });
  } catch (err) {
    return jsonApiError(err);
  }
}
