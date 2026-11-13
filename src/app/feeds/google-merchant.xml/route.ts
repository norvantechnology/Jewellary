import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { buildMerchantFeedXml } from "@/lib/seo/feeds";
import { getMerchantFeedProductsForXml } from "@/modules/catalog/catalog.public";
import { resolveActiveCurrencyByCode } from "@/modules/currencies/currency.service";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

function tokensMatch(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Token-protected Google Merchant Center XML feed.
 * Supports `?token=<MERCHANT_FEED_TOKEN>` or `Authorization: Bearer <MERCHANT_FEED_TOKEN>`,
 * plus optional `?country=US&currency=USD` query overrides for multi-country feeds.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const queryToken = request.nextUrl.searchParams.get("token")?.trim() ?? null;
  const supplied = bearerToken || queryToken;

  if (!tokensMatch(supplied, env.MERCHANT_FEED_TOKEN)) {
    return NextResponse.json({ error: "Valid merchant feed token required." }, { status: 401 });
  }

  const countryParam = request.nextUrl.searchParams.get("country")?.trim().toUpperCase();
  const currencyParam = request.nextUrl.searchParams.get("currency")?.trim().toUpperCase();

  const [settings, products, shippingZones] = await Promise.all([
    getPublicStoreSettings(),
    getMerchantFeedProductsForXml(),
    getAllShippingZones(true),
  ]);

  const targetCurrencyCode = currencyParam || settings.currency;
  const targetCurrency = await resolveActiveCurrencyByCode(targetCurrencyCode).catch(() => null);

  const rssXml = buildMerchantFeedXml(products, settings, {
    country: countryParam || settings.defaultCountry,
    currency: targetCurrency?.currency.code ?? targetCurrencyCode,
    conversionRate: targetCurrency ? Number(targetCurrency.currency.exchangeRate) : 1,
    decimals: targetCurrency?.currency.decimalPlaces ?? 2,
    shippingZones,
  });

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
