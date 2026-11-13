import { NextResponse } from "next/server";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function GET() {
  const [cart, settings] = await Promise.all([getCurrentCartSummary(), getPublicStoreSettings()]);

  return NextResponse.json(
    {
      cart,
      currency: settings.currency,
      freeShippingThreshold: settings.freeShippingThreshold,
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
