import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { listCustomerOrders } from "@/modules/account/account.service";
import { requireUser } from "@/server/dal";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser();
    const sp = request.nextUrl.searchParams;
    const rawPage = Number(sp.get("page") ?? "1");
    const rawPageSize = Number(sp.get("pageSize") ?? "10");

    const data = await listCustomerOrders(actor.user.id, {
      page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
      pageSize: Number.isFinite(rawPageSize) && rawPage >= 1 ? Math.floor(rawPageSize) : 10,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "Unable to fetch orders.");
  }
}
