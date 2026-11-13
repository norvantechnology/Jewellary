import { NextResponse, type NextRequest } from "next/server";
import {
  getServerRequestCurrency,
  getCurrencyCatalogContext,
} from "@/modules/currencies/currency.service";
import { AppError } from "@/server/errors";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";

/**
 * Public cached endpoint returning active storefront currencies plus detected visitor preference.
 */
export async function handleGetPublicCurrencies(request: NextRequest) {
  try {
    const ip = await getClientIp();
    await enforceRateLimit("publicCurrency", `ip:${ip}`);

    const detect = request.nextUrl.searchParams.get("detect") !== "0";
    if (detect) {
      const resolved = await getServerRequestCurrency();
      return NextResponse.json(
        {
          currencies: resolved.currencies,
          baseCurrency: resolved.baseCurrency.code,
          defaultCurrency: resolved.defaultCurrency.code,
          selectedCurrency: resolved.currency.code,
          detectionSource: resolved.source,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    const catalog = await getCurrencyCatalogContext();
    return NextResponse.json(
      {
        currencies: catalog.currencies,
        baseCurrency: catalog.baseCurrency.code,
        defaultCurrency: catalog.defaultCurrency.code,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to load currencies." } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleGetPublicCurrencies(request);
}
