import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { saveAddressSchema } from "@/modules/account/account.schemas";
import {
  deleteCustomerAddress,
  getCustomerAddressForRest,
  saveCustomerAddress,
} from "@/modules/account/account.service";
import { requireUser } from "@/server/dal";
import { ValidationError } from "@/server/errors";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const [actor, { id }] = await Promise.all([requireUser(), context.params]);
    const current = await getCustomerAddressForRest(actor.user.id, decodeURIComponent(id));

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON request body.");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("Invalid address update payload.");
    }

    const merged = {
      label: current.label,
      fullName: current.fullName,
      phone: current.phone,
      line1: current.line1,
      line2: current.line2,
      city: current.city,
      state: current.state,
      postalCode: current.postalCode,
      country: current.country,
      isDefaultShipping: current.isDefaultShipping,
      isDefaultBilling: current.isDefaultBilling,
      ...(body as Record<string, unknown>),
      id: current.id,
    };

    const parsed = saveAddressSchema.safeParse(merged);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new ValidationError(firstIssue?.message ?? "Invalid address fields.");
    }

    const updated = await saveCustomerAddress(actor.user.id, parsed.data);
    return NextResponse.json({ address: updated }, { status: 200 });
  } catch (err) {
    return apiErrorResponse(err, "Unable to update address.");
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const [actor, { id }] = await Promise.all([requireUser(), context.params]);
    await deleteCustomerAddress(actor.user.id, decodeURIComponent(id));
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    return apiErrorResponse(err, "Unable to delete address.");
  }
}
