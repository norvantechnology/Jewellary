// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COUNTRY_DIRECTORY,
  formatCountryName,
  formatPhoneWithDialCode,
  getCountryStates,
  splitPhoneByCountryDialCode,
  validatePhoneNumber,
  validatePostalCodeForCountry,
} from "@/lib/countries";
import {
  convertAmountFromBase,
  convertDisplayToBase,
  extractCountryFromAcceptLanguage,
  formatPrice,
  isCurrencySupportedByProvider,
  mapCountryToCurrencyCode,
  resolveCurrencyFromContext,
  resolveGatewayChargeTarget,
  type PublicCurrencyDTO,
} from "@/lib/currency";
import { fromMinorUnits, getCurrencyExponent, toMinorUnits } from "@/lib/money";
import { buildOrderInvoicePdf } from "@/lib/pdf";
import type { OrderConfirmationDTO } from "@/modules/orders/order.service";

const USD: PublicCurrencyDTO = {
  id: "cur_usd",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  symbolPosition: "BEFORE",
  decimalPlaces: 2,
  roundingRule: "HALF_UP",
  exchangeRate: "1.00000000",
  isBase: true,
  isDefault: true,
  isActive: true,
  sortOrder: 0,
  updatedAt: "2026-11-11T00:00:00.000Z",
};

const EUR: PublicCurrencyDTO = {
  id: "cur_eur",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  symbolPosition: "AFTER",
  decimalPlaces: 2,
  roundingRule: "HALF_EVEN",
  exchangeRate: "0.92340000",
  isBase: false,
  isDefault: false,
  isActive: true,
  sortOrder: 1,
  updatedAt: "2026-11-11T00:00:00.000Z",
};

const JPY: PublicCurrencyDTO = {
  id: "cur_jpy",
  code: "JPY",
  name: "Japanese Yen",
  symbol: "¥",
  symbolPosition: "BEFORE",
  decimalPlaces: 0,
  roundingRule: "CEIL",
  exchangeRate: "152.50000000",
  isBase: false,
  isDefault: false,
  isActive: true,
  sortOrder: 2,
  updatedAt: "2026-11-11T00:00:00.000Z",
};

const KWD: PublicCurrencyDTO = {
  id: "cur_kwd",
  code: "KWD",
  name: "Kuwaiti Dinar",
  symbol: "KWD",
  symbolPosition: "BEFORE",
  decimalPlaces: 3,
  roundingRule: "HALF_UP",
  exchangeRate: "0.30750000",
  isBase: false,
  isDefault: false,
  isActive: true,
  sortOrder: 3,
  updatedAt: "2026-11-11T00:00:00.000Z",
};

describe("Multi-currency conversion, rounding, formatting, and geo mapping", () => {
  it("converts base amounts accurately across rounding rules and decimal places", () => {
    // HALF_UP 2dp
    expect(convertAmountFromBase("100.00", USD).toFixed(2)).toBe("100.00");
    // CEIL 0dp for JPY (100 * 152.5 = 15250; 10.01 * 152.5 = 1526.525 -> ceil 1527)
    expect(convertAmountFromBase("10.01", JPY).toFixed(0)).toBe("1527");
    // FLOOR rule
    expect(convertAmountFromBase("10.01", { ...JPY, roundingRule: "FLOOR" }).toFixed(0)).toBe(
      "1526",
    );
    // KWD 3dp (100 * 0.3075 = 30.750; 1.111 * 0.3075 = 0.3416325 -> 0.342)
    expect(convertAmountFromBase("1.111", KWD).toFixed(3)).toBe("0.342");
    // Reverse conversion back to base
    expect(convertDisplayToBase("15250", JPY).toFixed(2)).toBe("100.00");
    expect(convertDisplayToBase("30.750", KWD).toFixed(2)).toBe("100.00");
  });

  it("computes gateway minor units safely for 0-dp, 2-dp, and 3-dp currencies", () => {
    expect(getCurrencyExponent("JPY")).toBe(0);
    expect(getCurrencyExponent("KWD")).toBe(3);
    expect(getCurrencyExponent("USD")).toBe(2);

    expect(toMinorUnits("15250", "JPY", true)).toBe(15250);
    expect(fromMinorUnits(15250, "JPY").toFixed(0)).toBe("15250");

    expect(toMinorUnits("100.50", "USD", true)).toBe(10050);
    expect(toMinorUnits("755.125", "KWD", false)).toBe(755125);
    // Stripe 3-decimal currencies must end in 0
    expect(toMinorUnits("755.125", "KWD", true) % 10).toBe(0);
    expect(fromMinorUnits(755120, "KWD").toFixed(3)).toBe("755.120");
  });

  it("formats prices honoring admin symbol position, decimals, exact mode, negatives, and snapshots", () => {
    expect(formatPrice("2450", USD)).toBe("$2,450");
    expect(formatPrice("2450", USD, { exact: true })).toBe("$2,450.00");
    expect(formatPrice("1000", EUR, { exact: true })).toBe("923.40 €");
    expect(formatPrice("1000", JPY)).toBe("¥152,500");
    expect(formatPrice("100", KWD, { exact: true })).toBe("KWD30.750");
    expect(formatPrice("-50", USD, { exact: true })).toBe("-$50.00");

    // Pre-converted snapshot must not multiply by exchangeRate again
    expect(formatPrice("15250", JPY, { alreadyConverted: true, exact: true })).toBe("¥15,250");
    expect(formatPrice("30.750", KWD, { alreadyConverted: true, exact: true })).toBe("KWD30.750");
  });

  it("maps country headers and Accept-Language tags to active currencies with deterministic fallback", () => {
    expect(mapCountryToCurrencyCode("jp")).toBe("JPY");
    expect(mapCountryToCurrencyCode("kw")).toBe("KWD");
    expect(mapCountryToCurrencyCode("gb")).toBe("GBP");
    expect(extractCountryFromAcceptLanguage("en-US;q=0.7, ja-JP;q=0.9")).toBe("JP");
    expect(extractCountryFromAcceptLanguage("fr")).toBe("FR");

    const active = [USD, EUR, JPY, KWD];

    // Precedence: userPreference -> cookie/storage -> geo -> acceptLanguage -> default
    expect(
      resolveCurrencyFromContext({
        activeCurrencies: active,
        userPreference: "KWD",
        cookieOrStoragePreference: "EUR",
        geoCountry: "JP",
        acceptLanguage: "en-US",
      }),
    ).toMatchObject({ source: "user", currency: { code: "KWD" } });

    expect(
      resolveCurrencyFromContext({
        activeCurrencies: active,
        userPreference: "CHF", // inactive!
        cookieOrStoragePreference: "JPY",
        geoCountry: "FR",
      }),
    ).toMatchObject({ source: "preference", currency: { code: "JPY" } });

    expect(
      resolveCurrencyFromContext({
        activeCurrencies: active,
        geoCountry: "JP",
        acceptLanguage: "en-US",
      }),
    ).toMatchObject({ source: "geo", currency: { code: "JPY" } });

    expect(
      resolveCurrencyFromContext({
        activeCurrencies: active,
        geoCountry: "ZZ",
        acceptLanguage: "de-DE,fr-FR;q=0.9",
      }),
    ).toMatchObject({ source: "accept_language", currency: { code: "EUR" } });

    // Unsupported/inactive currency falls back to default currency
    expect(
      resolveCurrencyFromContext({
        activeCurrencies: active,
        userPreference: "CHF",
        geoCountry: "ZZ",
        acceptLanguage: null,
      }),
    ).toMatchObject({ source: "default", currency: { code: "USD" } });
  });

  it("computes gateway settlement target & fallback notice cleanly", () => {
    expect(isCurrencySupportedByProvider("STRIPE", "JPY")).toBe(true);
    expect(isCurrencySupportedByProvider("STRIPE", "KWD")).toBe(true);
    expect(isCurrencySupportedByProvider("RAZORPAY", "JPY")).toBe(true);
    expect(isCurrencySupportedByProvider("RAZORPAY", "KWD")).toBe(false);

    const stripeJpy = resolveGatewayChargeTarget({
      provider: "STRIPE",
      orderCurrency: "JPY",
      orderTotal: "15250",
      baseCurrency: "USD",
      baseTotal: "100.00",
    });
    expect(stripeJpy).toEqual({
      chargedCurrency: "JPY",
      chargedAmount: "15250",
      chargeInBaseFallback: false,
    });

    const razorpayKwdFallback = resolveGatewayChargeTarget({
      provider: "RAZORPAY",
      orderCurrency: "KWD",
      orderTotal: "30.750",
      baseCurrency: "USD",
      baseTotal: "100.00",
    });
    expect(razorpayKwdFallback).toEqual({
      chargedCurrency: "USD",
      chargedAmount: "100.00",
      chargeInBaseFallback: true,
    });
  });
});

describe("Address book directory, validation helpers, and PDF receipt builder", () => {
  it("validates phones, dial-code splitting, states, and country-specific postal codes", () => {
    expect(COUNTRY_DIRECTORY.length).toBeGreaterThanOrEqual(20);
    expect(formatCountryName("us")).toBe("United States (US)");
    expect(getCountryStates("US").some((s) => s.code === "NY")).toBe(true);
    expect(getCountryStates("CA").some((s) => s.code === "ON")).toBe(true);

    expect(validatePhoneNumber("+1 212 555 0140")).toBeNull();
    expect(validatePhoneNumber("123")).not.toBeNull();

    expect(splitPhoneByCountryDialCode("+44 20 7946 0958", "GB")).toEqual({
      dialCode: "+44",
      localNumber: "20 7946 0958",
    });
    expect(formatPhoneWithDialCode("+91", "98200 98200")).toBe("+91 98200 98200");

    expect(validatePostalCodeForCountry("10013", "US")).toBeNull();
    expect(validatePostalCodeForCountry("10013-1234", "US")).toBeNull();
    expect(validatePostalCodeForCountry("ABC", "US")).not.toBeNull();

    expect(validatePostalCodeForCountry("M5V 2T6", "CA")).toBeNull();
    expect(validatePostalCodeForCountry("SW1A 1AA", "GB")).toBeNull();
    expect(validatePostalCodeForCountry("400001", "IN")).toBeNull();
    expect(validatePostalCodeForCountry("104-0061", "JP")).toBeNull();
    expect(validatePostalCodeForCountry("2000", "AU")).toBeNull();
    expect(validatePostalCodeForCountry("9999999", "US")).not.toBeNull();
  });

  it("renders a syntactically valid PDF 1.4 invoice buffer with immutable FX snapshot details", () => {
    const sampleOrder: OrderConfirmationDTO = {
      id: "ord_test_1",
      orderNumber: "ORD-2026-99100",
      status: "PAID",
      currency: "JPY",
      currencyDecimals: 0,
      baseCurrency: "USD",
      exchangeRate: "152.50000000",
      subtotal: "152500",
      shippingCost: "0",
      taxAmount: "12200",
      discountAmount: "5000",
      total: "159700",
      baseSubtotal: "1000.00",
      baseShippingCost: "0.00",
      baseTaxAmount: "80.00",
      baseDiscountAmount: "32.79",
      baseTotal: "1047.21",
      chargedCurrency: "JPY",
      chargedAmount: "159700",
      refundedAmount: "0",
      refundedAt: null,
      shippingMethodName: "Complimentary Armored Express",
      shippingAddress: {
        fullName: "Claire Laurent",
        phone: "+81 3 5555 0199",
        line1: "4-12-8 Ginza",
        line2: null,
        city: "Chuo-ku, Tokyo",
        state: "Tokyo",
        postalCode: "104-0061",
        country: "JP",
      },
      billingAddress: {
        fullName: "Claire Laurent",
        phone: "+81 3 5555 0199",
        line1: "4-12-8 Ginza",
        line2: null,
        city: "Chuo-ku, Tokyo",
        state: "Tokyo",
        postalCode: "104-0061",
        country: "JP",
      },
      giftNote: null,
      signatureRequired: true,
      reservedUntil: null,
      paidAt: "2026-11-11T10:00:00.000Z",
      shippedAt: null,
      deliveredAt: null,
      trackingNumber: null,
      carrier: null,
      trackingUrl: null,
      createdAt: "2026-11-11T09:58:00.000Z",
      contactEmail: "concierge@maisonaurelia.com",
      sandboxMode: true,
      paymentProvider: "STRIPE",
      paymentStatus: "SUCCEEDED",
      items: [
        {
          id: "item_1",
          productId: "prod_1",
          productSlug: "solitaire-lumiere",
          variantId: "var_1",
          skuSnapshot: "MA-SOL-001",
          titleSnapshot: "Lumiere Solitaire Ring",
          variantTitleSnapshot: "18k Yellow Gold · Size 6",
          imageUrlSnapshot: null,
          quantity: 1,
          unitPrice: "152500",
          lineTotal: "152500",
        },
      ],
      events: [],
    };

    const bytes = buildOrderInvoicePdf(sampleOrder, "Maison Aurelia");
    const text = Buffer.from(bytes).toString("latin1");

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("xref");
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("ORD-2026-99100");
    expect(text).toContain("JPY 159,700");
    expect(text).toContain("-JPY 5,000");
    expect(text).toContain("Lumiere Solitaire Ring");
  });
});
