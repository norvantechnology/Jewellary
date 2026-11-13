import "@/lib/zod-csp";
import { z } from "zod";

const FALLBACK_ISO_4217 = new Set([
  "AED",
  "AFN",
  "ALL",
  "AMD",
  "ANG",
  "AOA",
  "ARS",
  "AUD",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BGN",
  "BHD",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CDF",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CUP",
  "CVE",
  "CZK",
  "DJF",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ERN",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "GBP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HKD",
  "HNL",
  "HTG",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IQD",
  "IRR",
  "ISK",
  "JMD",
  "JOD",
  "JPY",
  "KES",
  "KGS",
  "KHR",
  "KMF",
  "KRW",
  "KWD",
  "KYD",
  "KZT",
  "LAK",
  "LBP",
  "LKR",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MXN",
  "MYR",
  "MZN",
  "NAD",
  "NGN",
  "NIO",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PGK",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "RON",
  "RSD",
  "RUB",
  "RWF",
  "SAR",
  "SBD",
  "SCR",
  "SDG",
  "SEK",
  "SGD",
  "SHP",
  "SLE",
  "SOS",
  "SRD",
  "STN",
  "SYP",
  "SZL",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TOP",
  "TRY",
  "TTD",
  "TWD",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "UYU",
  "UZS",
  "VES",
  "VND",
  "VUV",
  "WST",
  "XAF",
  "XCD",
  "XOF",
  "XPF",
  "YER",
  "ZAR",
  "ZMW",
]);

export function isValidIso4217Code(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) return false;
  try {
    const intlObj = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intlObj.supportedValuesOf === "function") {
      const supported = intlObj.supportedValuesOf("currency");
      if (supported.length > 0) {
        return supported.includes(upper) || FALLBACK_ISO_4217.has(upper);
      }
    }
  } catch {
    // Fallback to static ISO 4217 list
  }
  return FALLBACK_ISO_4217.has(upper);
}

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO 4217 code.")
  .refine(
    isValidIso4217Code,
    "Enter a recognized ISO 4217 currency code (e.g. USD, EUR, JPY, KWD).",
  );

export const createCurrencySchema = z
  .object({
    code: currencyCodeSchema,
    name: z.string().trim().min(2, "Currency name is required.").max(80),
    symbol: z.string().trim().min(1, "Symbol is required.").max(12),
    symbolPosition: z.enum(["BEFORE", "AFTER"]).default("BEFORE"),
    decimalPlaces: z.coerce.number().int().min(0).max(4).default(2),
    roundingRule: z.enum(["HALF_UP", "HALF_EVEN", "CEIL", "FLOOR", "NONE"]).default("HALF_UP"),
    exchangeRate: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .refine((v) => /^\d+(\.\d{1,8})?$/.test(v) && Number(v) > 0, {
        message: "Exchange rate must be a positive number with up to 8 decimals.",
      }),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    isBase: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    note: z
      .string()
      .trim()
      .max(240)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict();

export const updateCurrencySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(2).max(80).optional(),
    symbol: z.string().trim().min(1).max(12).optional(),
    symbolPosition: z.enum(["BEFORE", "AFTER"]).optional(),
    decimalPlaces: z.coerce.number().int().min(0).max(4).optional(),
    roundingRule: z.enum(["HALF_UP", "HALF_EVEN", "CEIL", "FLOOR", "NONE"]).optional(),
    exchangeRate: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .refine((v) => /^\d+(\.\d{1,8})?$/.test(v) && Number(v) > 0, {
        message: "Exchange rate must be greater than 0.",
      })
      .optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
    note: z
      .string()
      .trim()
      .max(240)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict();

export const deleteCurrencySchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

export const setPreferredCurrencySchema = z
  .object({
    code: currencyCodeSchema,
  })
  .strict();

export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;
export type SetPreferredCurrencyInput = z.infer<typeof setPreferredCurrencySchema>;
