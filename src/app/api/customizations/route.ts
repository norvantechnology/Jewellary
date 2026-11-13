import { NextResponse } from "next/server";
import { createCustomizationRequestSchema } from "@/modules/customization/customization.schemas";
import {
  createCustomizationRequest,
  listCustomerCustomizationRequests,
} from "@/modules/customization/customization.service";
import { getServerRequestCurrency } from "@/modules/currencies/currency.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function GET() {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const items = await listCustomerCustomizationRequests(actor);
    return NextResponse.json({ items });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const body = await req.json().catch(() => null);
    const parsed = createCustomizationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request payload.");
    }
    const currencyCtx = await getServerRequestCurrency();
    const created = await createCustomizationRequest(parsed.data, actor, currencyCtx.currency.code);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    return jsonApiError(err);
  }
}
