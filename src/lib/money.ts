import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = Decimal.Value | { toString(): string };

/**
 * Converts any valid numeric/Decimal/string value into a rounded 2-dp Decimal.
 */
export function toDecimal(value: MoneyInput): Decimal {
  return new Decimal(value.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Adds a sequence of monetary values safely using Decimal arithmetic.
 */
export function sumMoney(values: MoneyInput[]): Decimal {
  return values
    .reduce<Decimal>((acc, item) => acc.plus(toDecimal(item)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Computes unitPrice * quantity rounded to 2 decimal places.
 */
export function multiplyMoney(unitPrice: MoneyInput, quantity: number): Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, received ${quantity}`);
  }
  return toDecimal(unitPrice).times(quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculates tax amount given a subtotal, percentage rate (e.g. 8 for 8%), and inclusive flag.
 */
export function calculateTax(
  subtotal: MoneyInput,
  ratePercent: number,
  taxInclusive: boolean,
): Decimal {
  const base = toDecimal(subtotal);
  if (ratePercent <= 0 || base.lte(0)) {
    return new Decimal(0);
  }
  const rate = new Decimal(ratePercent).div(100);
  if (taxInclusive) {
    // Extract tax component from tax-inclusive price: base - base / (1 + rate)
    return base.minus(base.div(rate.plus(1))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return base.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Converts a Decimal currency amount to smallest minor units (e.g., cents / paise) for payment gateways.
 */
export function toMinorUnits(amount: MoneyInput, currency = "USD"): number {
  const zeroDecimalCurrencies = new Set(["JPY", "KRW", "VND"]);
  const multiplier = zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100;
  return toDecimal(amount).times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Converts smallest minor units back into a Decimal amount.
 */
export function fromMinorUnits(minorAmount: number, currency = "USD"): Decimal {
  const zeroDecimalCurrencies = new Set(["JPY", "KRW", "VND"]);
  const divisor = zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100;
  return new Decimal(minorAmount).div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a Decimal/numeric value using Intl.NumberFormat at the UI edge.
 */
export function formatMoney(amount: MoneyInput, currency = "USD", locale = "en-US"): string {
  const numeric = toDecimal(amount).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Formats a Decimal/numeric value with explicit 2 decimal places (used on invoices, checkout, feeds).
 */
export function formatMoneyExact(amount: MoneyInput, currency = "USD", locale = "en-US"): string {
  const numeric = toDecimal(amount).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function isEqualMoney(a: MoneyInput, b: MoneyInput): boolean {
  return toDecimal(a).equals(toDecimal(b));
}
