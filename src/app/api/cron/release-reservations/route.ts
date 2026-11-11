import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { releaseExpiredOrderReservations } from "@/modules/orders/order.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { verifyCronAuthorization } from "@/server/cron-auth";

async function handleRelease(request: Request) {
  const authError = verifyCronAuthorization(request);
  if (authError) return authError;

  const summary = await releaseExpiredOrderReservations(50);

  if (summary.productIds.length > 0) {
    revalidateTag(CACHE_TAGS.products, "max");
    for (const productId of summary.productIds) {
      revalidateTag(CACHE_TAGS.product(productId), "max");
    }
  }

  return NextResponse.json({
    ok: true,
    releasedCount: summary.releasedCount,
    orderNumbers: summary.orderNumbers,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return handleRelease(request);
}

export async function POST(request: Request) {
  return handleRelease(request);
}
