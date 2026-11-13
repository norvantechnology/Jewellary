import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-response";
import { buildOrderInvoicePdf } from "@/lib/pdf";
import { getOrderForInvoiceDownload } from "@/modules/account/account.service";
import { getOptionalSession } from "@/server/dal";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, session] = await Promise.all([context.params, getOptionalSession()]);
    const guestToken = request.nextUrl.searchParams.get("token");

    const { order, storeName } = await getOrderForInvoiceDownload({
      idOrOrderNumber: decodeURIComponent(id),
      userId: session?.user.id ?? null,
      userRole: session?.user.role ?? null,
      guestToken,
    });

    const pdfBytes = buildOrderInvoicePdf(order, storeName);
    const body = Buffer.from(pdfBytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "Unable to generate order invoice.");
  }
}
