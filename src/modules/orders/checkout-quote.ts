import Decimal from "decimal.js";
import { calculateTax, sumMoney, toDecimal } from "@/lib/money";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

export interface CheckoutQuoteOptionDTO {
  id: string;
  name: string;
  flatRate: string;
  effectiveRate: string;
  freeThreshold: string | null;
  isFreeShipping: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isInsured: boolean;
}

export interface CheckoutQuoteDTO {
  currency: string;
  shippingCountry: string;
  selectedZone: CheckoutQuoteOptionDTO;
  availableZones: CheckoutQuoteOptionDTO[];
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
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
 * Checkout summary, and atomic Order creation.
 */
export function calculateCheckoutQuote(params: {
  items: Array<{ lineTotal: string }>;
  shippingCountry: string;
  shippingZoneId?: string | null;
  zones: ShippingZoneDTO[];
  settings: PublicStoreSettings;
}): QuoteCalculationResult {
  const country = params.shippingCountry.trim().toUpperCase();
  const supported = params.settings.supportedCountries.map((c) => c.toUpperCase());

  if (supported.length > 0 && !supported.includes(country)) {
    return {
      ok: false,
      code: "UNSUPPORTED_COUNTRY",
      message: `Insured delivery is not currently available for ${country}.`,
    };
  }

  const activeZonesForCountry = params.zones.filter(
    (zone) => zone.isActive && zone.countries.map((c) => c.toUpperCase()).includes(country),
  );

  if (activeZonesForCountry.length === 0) {
    return {
      ok: false,
      code: "UNSUPPORTED_COUNTRY",
      message: `No insured courier zone is configured for ${country}. Please contact concierge for custom arrangements.`,
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

  const subtotal = sumMoney(params.items.map((item) => item.lineTotal));
  const ratePercent = new Decimal(params.settings.taxRate).times(100).toNumber();
  const taxAmount = calculateTax(subtotal, ratePercent, params.settings.taxInclusive);

  const computeZoneOption = (zone: ShippingZoneDTO): CheckoutQuoteOptionDTO => {
    const thresholdRaw = zone.freeThreshold ?? params.settings.freeShippingThreshold;
    const thresholdDec = thresholdRaw !== null ? toDecimal(thresholdRaw) : null;
    const qualifiesForFree = subtotal.gt(0) && thresholdDec !== null && subtotal.gte(thresholdDec);
    const effective = qualifiesForFree ? new Decimal(0) : toDecimal(zone.flatRate);

    return {
      id: zone.id,
      name: zone.name,
      flatRate: toDecimal(zone.flatRate).toFixed(2),
      effectiveRate: effective.toFixed(2),
      freeThreshold: thresholdDec ? thresholdDec.toFixed(2) : null,
      isFreeShipping: qualifiesForFree,
      estimatedDaysMin: zone.estimatedDaysMin,
      estimatedDaysMax: zone.estimatedDaysMax,
      isInsured: zone.isInsured,
    };
  };

  const availableZones = activeZonesForCountry.map(computeZoneOption);
  const selectedOption = availableZones.find((z) => z.id === chosen.id) ?? availableZones[0]!;

  const shippingCost = toDecimal(selectedOption.effectiveRate);
  const total = params.settings.taxInclusive
    ? subtotal.plus(shippingCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : subtotal.plus(shippingCost).plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let amountToFreeShipping: string | null = null;
  if (!selectedOption.isFreeShipping && selectedOption.freeThreshold !== null) {
    const remaining = toDecimal(selectedOption.freeThreshold).minus(subtotal);
    if (remaining.gt(0)) {
      amountToFreeShipping = remaining.toFixed(2);
    }
  }

  const signatureRequired = subtotal.gte(toDecimal(params.settings.signatureThreshold));

  return {
    ok: true,
    quote: {
      currency: params.settings.currency,
      shippingCountry: country,
      selectedZone: selectedOption,
      availableZones,
      subtotal: subtotal.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      taxLabel: params.settings.taxLabel,
      taxRateDecimal: new Decimal(params.settings.taxRate).toFixed(4),
      taxInclusive: params.settings.taxInclusive,
      total: total.toFixed(2),
      isFreeShipping: selectedOption.isFreeShipping,
      freeShippingThreshold: selectedOption.freeThreshold,
      amountToFreeShipping,
      signatureRequired,
    },
  };
}
