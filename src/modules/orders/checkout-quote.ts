import Decimal from "decimal.js";
import { convertAmountFromBase, type PublicCurrencyDTO } from "@/lib/currency";
import { calculateTax, multiplyMoney, sumMoney, toDecimal } from "@/lib/money";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

export interface CheckoutQuoteOptionDTO {
  id: string;
  name: string;
  flatRate: string;
  effectiveRate: string;
  freeThreshold: string | null;
  baseFlatRate: string;
  baseEffectiveRate: string;
  baseFreeThreshold: string | null;
  isFreeShipping: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isInsured: boolean;
}

export interface CheckoutQuoteDTO {
  currency: string;
  currencyDecimals: number;
  baseCurrency: string;
  exchangeRate: string;
  shippingCountry: string;
  selectedZone: CheckoutQuoteOptionDTO;
  availableZones: CheckoutQuoteOptionDTO[];
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  baseSubtotal: string;
  baseShippingCost: string;
  baseTaxAmount: string;
  baseTotal: string;
  taxLabel: string;
  taxRateDecimal: string;
  taxInclusive: boolean;
  total: string;
  isFreeShipping: boolean;
  freeShippingThreshold: string | null;
  amountToFreeShipping: string | null;
  signatureRequired: boolean;
}

export type QuoteCalculationResult =
  | { ok: true; quote: CheckoutQuoteDTO }
  | { ok: false; code: "UNSUPPORTED_COUNTRY" | "INVALID_ZONE"; message: string };

/**
 * Pure server-reproducible quote computation shared across Cart estimator,
 * Checkout summary, and atomic Order creation. Computes authoritative totals
 * in base currency AND converts deterministically to the selected currency.
 */
export function calculateCheckoutQuote(params: {
  items: Array<{ lineTotal: string; unitPrice?: string; quantity?: number }>;
  shippingCountry: string;
  shippingZoneId?: string | null;
  zones: ShippingZoneDTO[];
  settings: PublicStoreSettings;
  targetCurrency?: PublicCurrencyDTO | null;
}): QuoteCalculationResult {
  const country = params.shippingCountry.trim().toUpperCase();
  const supported = params.settings.supportedCountries.map((c) => c.toUpperCase());

  if (supported.length > 0 && !supported.includes(country)) {
    return {
      ok: false,
      code: "UNSUPPORTED_COUNTRY",
      message: `We don't ship to ${country} yet.`,
    };
  }

  const activeZonesForCountry = params.zones.filter(
    (zone) => zone.isActive && zone.countries.map((c) => c.toUpperCase()).includes(country),
  );

  if (activeZonesForCountry.length === 0) {
    return {
      ok: false,
      code: "UNSUPPORTED_COUNTRY",
      message: `We don't ship to ${country} yet. Please contact us and we'll help arrange delivery.`,
    };
  }

  let chosen = activeZonesForCountry[0]!;
  if (params.shippingZoneId) {
    const requested = activeZonesForCountry.find((z) => z.id === params.shippingZoneId);
    if (!requested) {
      return {
        ok: false,
        code: "INVALID_ZONE",
        message: "The selected shipping method does not service this destination country.",
      };
    }
    chosen = requested;
  }

  const baseCode = params.settings.currency.trim().toUpperCase() || "USD";
  const target: PublicCurrencyDTO = params.targetCurrency ?? {
    id: `base-${baseCode}`,
    code: baseCode,
    name: baseCode,
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
  const dp = Math.min(4, Math.max(0, Math.trunc(target.decimalPlaces)));
  const isBaseTarget = target.code === baseCode && new Decimal(target.exchangeRate).equals(1);

  const baseSubtotal = sumMoney(
    params.items.map((item) => item.lineTotal),
    2,
  );
  const ratePercent = new Decimal(params.settings.taxRate).times(100).toNumber();
  const baseTaxAmount = calculateTax(baseSubtotal, ratePercent, params.settings.taxInclusive, 2);

  // Convert line items consistently so converted subtotal equals sum of converted item lines
  const convertedLineTotals = params.items.map((item) => {
    if (isBaseTarget) return toDecimal(item.lineTotal, dp);
    if (item.unitPrice !== undefined && item.quantity !== undefined) {
      const unitConverted = convertAmountFromBase(item.unitPrice, target);
      return multiplyMoney(unitConverted, item.quantity, dp);
    }
    return convertAmountFromBase(item.lineTotal, target);
  });
  const subtotal = sumMoney(convertedLineTotals, dp);
  const taxAmount = calculateTax(subtotal, ratePercent, params.settings.taxInclusive, dp);

  const computeZoneOption = (zone: ShippingZoneDTO): CheckoutQuoteOptionDTO => {
    const thresholdRaw = zone.freeThreshold ?? params.settings.freeShippingThreshold;
    const baseThresholdDec = thresholdRaw !== null ? toDecimal(thresholdRaw, 2) : null;
    const qualifiesForFree =
      baseSubtotal.gt(0) && baseThresholdDec !== null && baseSubtotal.gte(baseThresholdDec);
    const baseFlat = toDecimal(zone.flatRate, 2);
    const baseEffective = qualifiesForFree ? new Decimal(0) : baseFlat;

    const flatConverted = isBaseTarget ? baseFlat : convertAmountFromBase(baseFlat, target);
    const effectiveConverted = qualifiesForFree ? new Decimal(0) : flatConverted;
    const thresholdConverted = baseThresholdDec
      ? isBaseTarget
        ? baseThresholdDec
        : convertAmountFromBase(baseThresholdDec, target)
      : null;

    return {
      id: zone.id,
      name: zone.name,
      flatRate: flatConverted.toFixed(dp),
      effectiveRate: effectiveConverted.toFixed(dp),
      freeThreshold: thresholdConverted ? thresholdConverted.toFixed(dp) : null,
      baseFlatRate: baseFlat.toFixed(2),
      baseEffectiveRate: baseEffective.toFixed(2),
      baseFreeThreshold: baseThresholdDec ? baseThresholdDec.toFixed(2) : null,
      isFreeShipping: qualifiesForFree,
      estimatedDaysMin: zone.estimatedDaysMin,
      estimatedDaysMax: zone.estimatedDaysMax,
      isInsured: zone.isInsured,
    };
  };

  const availableZones = activeZonesForCountry.map(computeZoneOption);
  const selectedOption = availableZones.find((z) => z.id === chosen.id) ?? availableZones[0]!;

  const baseShippingCost = toDecimal(selectedOption.baseEffectiveRate, 2);
  const baseTotal = params.settings.taxInclusive
    ? baseSubtotal.plus(baseShippingCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : baseSubtotal
        .plus(baseShippingCost)
        .plus(baseTaxAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const shippingCost = toDecimal(selectedOption.effectiveRate, dp);
  const total = params.settings.taxInclusive
    ? subtotal.plus(shippingCost).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)
    : subtotal.plus(shippingCost).plus(taxAmount).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);

  let amountToFreeShipping: string | null = null;
  if (!selectedOption.isFreeShipping && selectedOption.baseFreeThreshold !== null) {
    const baseRemaining = toDecimal(selectedOption.baseFreeThreshold, 2).minus(baseSubtotal);
    if (baseRemaining.gt(0)) {
      const convertedRemaining = isBaseTarget
        ? baseRemaining
        : convertAmountFromBase(baseRemaining, target);
      amountToFreeShipping = convertedRemaining.toFixed(dp);
    }
  }

  const signatureRequired = baseSubtotal.gte(toDecimal(params.settings.signatureThreshold, 2));

  return {
    ok: true,
    quote: {
      currency: target.code,
      currencyDecimals: dp,
      baseCurrency: baseCode,
      exchangeRate: new Decimal(target.exchangeRate).toFixed(8),
      shippingCountry: country,
      selectedZone: selectedOption,
      availableZones,
      subtotal: subtotal.toFixed(dp),
      shippingCost: shippingCost.toFixed(dp),
      taxAmount: taxAmount.toFixed(dp),
      baseSubtotal: baseSubtotal.toFixed(2),
      baseShippingCost: baseShippingCost.toFixed(2),
      baseTaxAmount: baseTaxAmount.toFixed(2),
      baseTotal: baseTotal.toFixed(2),
      taxLabel: params.settings.taxLabel,
      taxRateDecimal: new Decimal(params.settings.taxRate).toFixed(4),
      taxInclusive: params.settings.taxInclusive,
      total: total.toFixed(dp),
      isFreeShipping: selectedOption.isFreeShipping,
      freeShippingThreshold: selectedOption.freeThreshold,
      amountToFreeShipping,
      signatureRequired,
    },
  };
}
