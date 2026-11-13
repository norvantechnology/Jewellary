import Decimal from "decimal.js";
import { getCurrencyExponent, type MoneyInput } from "@/lib/money";

export type CurrencySymbolPosition = "BEFORE" | "AFTER";
export type CurrencyRoundingRule = "HALF_UP" | "HALF_EVEN" | "CEIL" | "FLOOR" | "NONE";

export interface PublicCurrencyDTO {
  id: string;
  code: string;
  name: string;
  symbol: string;
  symbolPosition: CurrencySymbolPosition;
  decimalPlaces: number;
  roundingRule: CurrencyRoundingRule;
  exchangeRate: string;
  isActive: boolean;
  isDefault: boolean;
  isBase: boolean;
  sortOrder: number;
  updatedAt: string;
}

export const CURRENCY_COOKIE_NAME = "ma_currency";
export const CURRENCY_STORAGE_KEY = "ma_currency_code";

export const FALLBACK_BASE_CURRENCY: PublicCurrencyDTO = {
  id: "fallback-usd",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  symbolPosition: "BEFORE",
  decimalPlaces: 2,
  roundingRule: "HALF_UP",
  exchangeRate: "1.00000000",
  isActive: true,
  isDefault: true,
  isBase: true,
  sortOrder: 0,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Comprehensive country (ISO 3166-1 alpha-2) -> currency (ISO 4217) mapping for geo detection.
 */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  PR: "USD",
  GU: "USD",
  VI: "USD",
  AS: "USD",
  CA: "CAD",
  GB: "GBP",
  UK: "GBP",
  IM: "GBP",
  JE: "GBP",
  GG: "GBP",
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MC: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
  JP: "JPY",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  IN: "INR",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  LI: "CHF",
  SG: "SGD",
  HK: "HKD",
  KR: "KRW",
  CN: "CNY",
  TW: "TWD",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  TH: "THB",
  MY: "MYR",
  IL: "ILS",
};

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: "US",
  fr: "FR",
  de: "DE",
  it: "IT",
  es: "ES",
  nl: "NL",
  pt: "PT",
  ja: "JP",
  ar: "AE",
  hi: "IN",
  ko: "KR",
  zh: "CN",
  sv: "SE",
  nb: "NO",
  nn: "NO",
  da: "DK",
  pl: "PL",
};

/**
 * Payment gateway currency support tables (ISO 4217 uppercase).
 * Stripe processes most major and minor currencies (excluding a handful of embargoed/non-convertible ones);
 * Razorpay international supports major currencies while falling back for niche ones.
 */
export const STRIPE_SUPPORTED_CURRENCIES = new Set<string>([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "TND",
  "CAD",
  "AUD",
  "CHF",
  "INR",
  "AED",
  "SAR",
  "QAR",
  "SGD",
  "HKD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "ZAR",
  "BRL",
  "MXN",
  "KRW",
  "CNY",
  "THB",
  "MYR",
  "ILS",
  "TWD",
  "TRY",
  "HUF",
  "RON",
]);

export const RAZORPAY_SUPPORTED_CURRENCIES = new Set<string>([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "HKD",
  "NZD",
  "MYR",
  "QAR",
  "SAR",
  "SEK",
  "NOK",
  "DKK",
]);

export function isCurrencySupportedByProvider(
  provider: "STRIPE" | "RAZORPAY",
  currencyCode: string,
): boolean {
  const code = currencyCode.trim().toUpperCase();
  return provider === "RAZORPAY"
    ? RAZORPAY_SUPPORTED_CURRENCIES.has(code)
    : STRIPE_SUPPORTED_CURRENCIES.has(code);
}

/**
 * Resolves whether the payment gateway can charge in the customer's selected order currency,
 * or must fall back to the store base currency.
 */
export function resolveGatewayChargeTarget(params: {
  provider: "STRIPE" | "RAZORPAY";
  orderCurrency: string;
  orderTotal: string;
  baseCurrency: string;
  baseTotal: string;
}): {
  chargeInBaseFallback: boolean;
  chargedCurrency: string;
  chargedAmount: string;
} {
  const orderCode = params.orderCurrency.trim().toUpperCase();
  const baseCode = params.baseCurrency.trim().toUpperCase();
  if (orderCode === baseCode || isCurrencySupportedByProvider(params.provider, orderCode)) {
    return {
      chargeInBaseFallback: false,
      chargedCurrency: orderCode,
      chargedAmount: params.orderTotal,
    };
  }
  return {
    chargeInBaseFallback: true,
    chargedCurrency: baseCode,
    chargedAmount: params.baseTotal,
  };
}

function toDecimalRoundingMode(rule: CurrencyRoundingRule): Decimal.Rounding {
  switch (rule) {
    case "HALF_EVEN":
      return Decimal.ROUND_HALF_EVEN;
    case "CEIL":
      return Decimal.ROUND_CEIL;
    case "FLOOR":
      return Decimal.ROUND_FLOOR;
    case "HALF_UP":
    case "NONE":
    default:
      return Decimal.ROUND_HALF_UP;
  }
}

/**
 * Converts a monetary amount stored in the store's base currency into the target currency
 * using its exchangeRate, roundingRule, and decimalPlaces.
 */
export function convertAmountFromBase(
  amountInBase: MoneyInput,
  currency: Pick<PublicCurrencyDTO, "exchangeRate" | "decimalPlaces" | "roundingRule">,
): Decimal {
  const raw = new Decimal(amountInBase.toString()).times(new Decimal(currency.exchangeRate));
  const dp = Math.min(4, Math.max(0, Math.trunc(currency.decimalPlaces)));
  if (currency.roundingRule === "NONE") {
    return raw.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  }
  return raw.toDecimalPlaces(dp, toDecimalRoundingMode(currency.roundingRule));
}

/**
 * Converts a display-currency amount back into the base currency (e.g., for collection price filters).
 */
export function convertDisplayToBase(
  displayAmount: MoneyInput,
  currency: Pick<PublicCurrencyDTO, "exchangeRate">,
): Decimal {
  const rate = new Decimal(currency.exchangeRate);
  if (rate.lte(0)) {
    return new Decimal(displayAmount.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return new Decimal(displayAmount.toString()).div(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Memoized Intl.NumberFormat registry to prevent re-creating formatters per price cell.
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getMemoizedNumberFormat(
  locale: string,
  code: string,
  minFractionDigits: number,
  maxFractionDigits: number,
): Intl.NumberFormat {
  const key = `${locale}::${code}::${minFractionDigits}::${maxFractionDigits}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits,
      });
    }
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

export interface FormatPriceOptions {
  locale?: string;
  /** When true, always prints full configured decimalPlaces (e.g., 1200.00). When false (default), omits trailing zeros on whole amounts unless 3-dp or compact decimals disabled. */
  exact?: boolean;
  /** Set true when amount is ALREADY in target currency (e.g., snapshotted Order.total), skipping FX conversion. */
  alreadyConverted?: boolean;
}

/**
 * Formats any base-currency (or pre-converted) amount using Intl.NumberFormat while honoring
 * admin-defined decimals, custom symbol, and symbolPosition (BEFORE / AFTER).
 */
export function formatPrice(
  amount: MoneyInput,
  currency: Pick<
    PublicCurrencyDTO,
    "code" | "symbol" | "symbolPosition" | "decimalPlaces" | "roundingRule" | "exchangeRate"
  >,
  options: FormatPriceOptions = {},
): string {
  const { locale = "en-US", exact = false, alreadyConverted = false } = options;
  const dp = Math.min(
    4,
    Math.max(0, Math.trunc(currency.decimalPlaces ?? getCurrencyExponent(currency.code))),
  );

  const valueDec = alreadyConverted
    ? new Decimal(amount.toString()).toDecimalPlaces(
        dp,
        toDecimalRoundingMode(currency.roundingRule),
      )
    : convertAmountFromBase(amount, currency);

  const numeric = valueDec.toNumber();
  const isWhole = valueDec.isInteger();
  const minFractionDigits = dp === 0 ? 0 : exact ? dp : isWhole ? 0 : dp;

  const formatter = getMemoizedNumberFormat(locale, currency.code, minFractionDigits, dp);
  const parts = formatter.formatToParts(Math.abs(numeric));
  const numberBody = parts
    .filter((p) =>
      p.type !== "currency" && p.type !== "literal"
        ? true
        : p.type === "literal" && !p.value.trim(),
    )
    .map((p) => p.value)
    .join("")
    .trim();

  const formattedMagnitude =
    currency.symbolPosition === "AFTER"
      ? `${numberBody} ${currency.symbol}`
      : `${currency.symbol}${numberBody}`;

  return numeric < 0 ? `-${formattedMagnitude}` : formattedMagnitude;
}

/**
 * Parses Accept-Language header in priority order to extract a 2-letter country code if present.
 */
export function extractCountryFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): string | null {
  if (!acceptLanguage) return null;
  const tags = acceptLanguage
    .split(",")
    .map((segment) => {
      const [tagPart, qPart] = segment.trim().split(";");
      const q = qPart?.startsWith("q=") ? Number(qPart.slice(2)) : 1;
      return { tag: (tagPart ?? "").trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const parts = tag.split(/[-_]/);
    if (parts.length >= 2) {
      const maybeRegion = parts[parts.length - 1]!.toUpperCase();
      if (/^[A-Z]{2}$/.test(maybeRegion) && COUNTRY_TO_CURRENCY[maybeRegion]) {
        return maybeRegion;
      }
    }
    const lang = parts[0]?.toLowerCase();
    if (lang && LANGUAGE_TO_COUNTRY[lang]) {
      return LANGUAGE_TO_COUNTRY[lang]!;
    }
  }
  return null;
}

export function mapCountryToCurrencyCode(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return COUNTRY_TO_CURRENCY[normalized] ?? null;
}

/**
 * Resolves the active currency strictly following fallback priority:
 * userPreference -> explicitPreference (cookie/localStorage) -> geoCountry -> acceptLanguage -> defaultCurrency -> baseCurrency.
 */
export function resolveCurrencyFromContext(params: {
  activeCurrencies: PublicCurrencyDTO[];
  userPreference?: string | null;
  cookieOrStoragePreference?: string | null;
  geoCountry?: string | null;
  acceptLanguage?: string | null;
}): {
  currency: PublicCurrencyDTO;
  source: "user" | "preference" | "geo" | "accept_language" | "default";
} {
  const list =
    params.activeCurrencies.length > 0 ? params.activeCurrencies : [FALLBACK_BASE_CURRENCY];
  const byCode = new Map(list.map((c) => [c.code.toUpperCase(), c]));
  const defaultCurrency = list.find((c) => c.isDefault) ?? list.find((c) => c.isBase) ?? list[0]!;

  const findActive = (code: string | null | undefined): PublicCurrencyDTO | null => {
    if (!code) return null;
    return byCode.get(code.trim().toUpperCase()) ?? null;
  };

  const userMatch = findActive(params.userPreference);
  if (userMatch) return { currency: userMatch, source: "user" };

  const prefMatch = findActive(params.cookieOrStoragePreference);
  if (prefMatch) return { currency: prefMatch, source: "preference" };

  const geoCurrency = mapCountryToCurrencyCode(params.geoCountry);
  const geoMatch = findActive(geoCurrency);
  if (geoMatch) return { currency: geoMatch, source: "geo" };

  const langCountry = extractCountryFromAcceptLanguage(params.acceptLanguage);
  const langCurrency = mapCountryToCurrencyCode(langCountry);
  const langMatch = findActive(langCurrency);
  if (langMatch) return { currency: langMatch, source: "accept_language" };

  return { currency: defaultCurrency, source: "default" };
}
