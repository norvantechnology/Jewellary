import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { getCustomerOrderByIdOrNumberForRest } from "@/modules/account/account.service";
import { requireUser } from "@/server/dal";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;
    const order = await getCustomerOrderByIdOrNumberForRest(actor.user.id, decodeURIComponent(id));

    return NextResponse.json(
      { order },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    return apiErrorResponse(err, "Unable to load order.");
  }
}
