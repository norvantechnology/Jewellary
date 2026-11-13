import { NextResponse } from "next/server";
import { exportCustomerPersonalData } from "@/modules/account/account.service";
import { writeAuditLog } from "@/server/audit";
import { requireUser } from "@/server/dal";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";

export async function GET() {
  try {
    const actor = await requireUser();
    await enforceRateLimit("accountExport", `user:${actor.user.id}`);

    const payload = await exportCustomerPersonalData(actor.user.id);

    await writeAuditLog({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      actorRole: actor.user.role,
      action: "ACCOUNT_DATA_EXPORT",
      entityType: "User",
      entityId: actor.user.id,
      after: {
        orderCount: payload.orders.length,
        addressCount: payload.addresses.length,
        wishlistCount: payload.wishlist.length,
        enquiryCount: payload.enquiries.length,
      },
    });

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="personal-data-export-${today}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to export personal data." } },
      { status: 500 },
    );
  }
}
