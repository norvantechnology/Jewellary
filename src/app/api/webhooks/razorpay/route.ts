import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { processVerifiedWebhookEvent } from "@/modules/orders/order.service";
import { RazorpayPaymentAdapter } from "@/modules/payments/razorpay.adapter";
import { CACHE_TAGS } from "@/server/cache-tags";
import { ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const adapter = new RazorpayPaymentAdapter();
  try {
    const verified = await adapter.verifyWebhookSignature(rawBody, signature);
    const result = await processVerifiedWebhookEvent(verified);

    if (!result.duplicate && result.productIds.length > 0) {
      revalidateTag(CACHE_TAGS.products, "max");
      for (const productId of result.productIds) {
        revalidateTag(CACHE_TAGS.product(productId), "max");
      }
    }

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      orderId: result.processedOrderId,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 },
      );
    }

    logger.error({ err }, "Razorpay webhook processing failed");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Webhook processing failed." } },
      { status: 500 },
    );
  }
}
