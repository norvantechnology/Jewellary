import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { saveAddressSchema } from "@/modules/account/account.schemas";
import {
  listCustomerAddresses,
  MAX_ADDRESSES_PER_USER,
  saveCustomerAddress,
} from "@/modules/account/account.service";
import { requireUser } from "@/server/dal";
import { ValidationError } from "@/server/errors";

export async function GET() {
  try {
    const actor = await requireUser();
    const addresses = await listCustomerAddresses(actor.user.id);
    return NextResponse.json(
      { addresses, maxAddresses: MAX_ADDRESSES_PER_USER },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return apiErrorResponse(err, "Unable to fetch addresses.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON request body.");
    }

    const parsed = saveAddressSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new ValidationError(firstIssue?.message ?? "Invalid address payload.");
    }

    const created = await saveCustomerAddress(actor.user.id, {
      ...parsed.data,
      id: null,
    });
    return NextResponse.json({ address: created }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Unable to create address.");
  }
}
