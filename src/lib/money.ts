import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = Decimal.Value | { toString(): string };

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/**
 * Returns standard ISO 4217 exponent (minor-unit decimal places) for a currency code.
 */
export function getCurrencyExponent(currency = "USD"): number {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/**
 * Converts any valid numeric/Decimal/string value into a rounded Decimal (default 2-dp).
 */
export function toDecimal(value: MoneyInput, decimalPlaces = 2): Decimal {
  const dp = Math.min(8, Math.max(0, Math.trunc(decimalPlaces)));
  return new Decimal(value.toString()).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
}

/**
 * Adds a sequence of monetary values safely using Decimal arithmetic.
 */
export function sumMoney(values: MoneyInput[], decimalPlaces = 2): Decimal {
  return values
    .reduce<Decimal>((acc, item) => acc.plus(toDecimal(item, decimalPlaces)), new Decimal(0))
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

export function subtractMoney(a: MoneyInput, b: MoneyInput, decimalPlaces = 2): Decimal {
  return toDecimal(a, decimalPlaces)
    .minus(toDecimal(b, decimalPlaces))
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Computes unitPrice * quantity rounded to currency decimal places.
 */
export function multiplyMoney(unitPrice: MoneyInput, quantity: number, decimalPlaces = 2): Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, received ${quantity}`);
  }
  return toDecimal(unitPrice, decimalPlaces)
    .times(quantity)
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Calculates tax amount given a subtotal, percentage rate (e.g. 8 for 8%), and inclusive flag.
 */
export function calculateTax(
  subtotal: MoneyInput,
  ratePercent: number,
  taxInclusive: boolean,
  decimalPlaces = 2,
): Decimal {
  const base = toDecimal(subtotal, decimalPlaces);
  if (ratePercent <= 0 || base.lte(0)) {
    return new Decimal(0);
  }
  const rate = new Decimal(ratePercent).div(100);
  if (taxInclusive) {
    // Extract tax component from tax-inclusive price: base - base / (1 + rate)
    return base.minus(base.div(rate.plus(1))).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  }
  return base.times(rate).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Converts a Decimal currency amount to smallest minor units (0-dp JPY, 2-dp USD, 3-dp KWD) for payment gateways.
 */
export function toMinorUnits(
  amount: MoneyInput,
  currency = "USD",
  stripeCompatible = false,
): number {
  const exponent = getCurrencyExponent(currency);
  const multiplier = Math.pow(10, exponent);
  const minor = toDecimal(amount, exponent)
    .times(multiplier)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  if (stripeCompatible && exponent === 3) {
    // Stripe requires 3-decimal currency integer amounts to end in 0 (divisible by 10).
    return Math.round(minor / 10) * 10;
  }
  return minor;
}

/**
 * Converts smallest minor units back into a Decimal amount.
 */
export function fromMinorUnits(minorAmount: number, currency = "USD"): Decimal {
  const exponent = getCurrencyExponent(currency);
  const divisor = Math.pow(10, exponent);
  return new Decimal(minorAmount).div(divisor).toDecimalPlaces(exponent, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a Decimal/numeric value using Intl.NumberFormat at the UI edge.
 */
export function formatMoney(
  amount: MoneyInput,
  currency = "USD",
  locale = "en-US",
  decimalPlaces?: number,
): string {
  const dp = decimalPlaces ?? getCurrencyExponent(currency);
  const numeric = toDecimal(amount, dp).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: dp === 0 ? 0 : numeric % 1 === 0 ? 0 : dp,
    maximumFractionDigits: dp,
  }).format(numeric);
}

/**
 * Formats a Decimal/numeric value with explicit currency decimal places (used on invoices, checkout, feeds).
 */
export function formatMoneyExact(
  amount: MoneyInput,
  currency = "USD",
  locale = "en-US",
  decimalPlaces?: number,
): string {
  const dp = decimalPlaces ?? getCurrencyExponent(currency);
  const numeric = toDecimal(amount, dp).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(numeric);
}

export function isEqualMoney(a: MoneyInput, b: MoneyInput): boolean {
  return toDecimal(a).equals(toDecimal(b));
}
