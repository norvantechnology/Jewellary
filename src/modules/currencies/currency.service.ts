import "server-only";
import { cache } from "react";
import Decimal from "decimal.js";
import { cacheLife, cacheTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import {
  CURRENCY_COOKIE_NAME,
  FALLBACK_BASE_CURRENCY,
  type CurrencyRoundingRule,
  type CurrencySymbolPosition,
  type PublicCurrencyDTO,
  resolveCurrencyFromContext,
} from "@/lib/currency";
import type {
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from "@/modules/currencies/currency.schemas";
import { CACHE_TAGS } from "@/server/cache-tags";
import { getOptionalSession } from "@/server/dal";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export interface AdminCurrencyDTO extends PublicCurrencyDTO {
  createdAt: string;
}

export interface CurrencyRateHistoryDTO {
  id: string;
  currencyId: string;
  currencyCode: string;
  oldRate: string;
  newRate: string;
  changedById: string | null;
  changedByEmail: string | null;
  note: string | null;
  createdAt: string;
}

export interface CurrencyActorInfo {
  id?: string | null;
  email?: string | null;
}

function mapCurrencyRow(row: {
  id: string;
  code: string;
  name: string;
  symbol: string;
  symbolPosition: CurrencySymbolPosition;
  decimalPlaces: number;
  roundingRule: CurrencyRoundingRule;
  exchangeRate: Prisma.Decimal;
  isActive: boolean;
  isDefault: boolean;
  isBase: boolean;
  sortOrder: number;
  updatedAt: Date;
}): PublicCurrencyDTO {
  return {
    id: row.id,
    code: row.code.trim().toUpperCase(),
    name: row.name,
    symbol: row.symbol,
    symbolPosition: row.symbolPosition,
    decimalPlaces: row.decimalPlaces,
    roundingRule: row.roundingRule,
    exchangeRate: row.exchangeRate.toFixed(8),
    isActive: row.isActive,
    isDefault: row.isDefault,
    isBase: row.isBase,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Returns active currencies cached across requests and tagged with `currencies`.
 */
export async function getActiveCurrencies(): Promise<PublicCurrencyDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.currencies, CACHE_TAGS.settings);

  const rows = await db.currency.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  if (rows.length === 0) {
    return [FALLBACK_BASE_CURRENCY];
  }

  return rows.map(mapCurrencyRow);
}

/**
 * Resolves base & default currencies synchronously from active list.
 */
export async function getCurrencyCatalogContext(): Promise<{
  currencies: PublicCurrencyDTO[];
  baseCurrency: PublicCurrencyDTO;
  defaultCurrency: PublicCurrencyDTO;
}> {
  const currencies = await getActiveCurrencies();
  const baseCurrency = currencies.find((c) => c.isBase) ?? currencies[0] ?? FALLBACK_BASE_CURRENCY;
  const defaultCurrency =
    currencies.find((c) => c.isDefault) ?? baseCurrency ?? FALLBACK_BASE_CURRENCY;
  return { currencies, baseCurrency, defaultCurrency };
}

/**
 * Finds an active currency by code, falling back to default/base currency if missing or inactive.
 */
export async function resolveActiveCurrencyByCode(requestedCode?: string | null): Promise<{
  currency: PublicCurrencyDTO;
  baseCurrency: PublicCurrencyDTO;
  defaultCurrency: PublicCurrencyDTO;
}> {
  const { currencies, baseCurrency, defaultCurrency } = await getCurrencyCatalogContext();
  if (!requestedCode) {
    return { currency: defaultCurrency, baseCurrency, defaultCurrency };
  }
  const normalized = requestedCode.trim().toUpperCase();
  const matched = currencies.find((c) => c.code === normalized);
  return {
    currency: matched ?? defaultCurrency,
    baseCurrency,
    defaultCurrency,
  };
}

async function safeOptionalSession() {
  try {
    return await getOptionalSession();
  } catch {
    return null;
  }
}

async function safeCookies() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

async function safeHeaders() {
  try {
    return await headers();
  } catch {
    return null;
  }
}

/**
 * Resolves the visitor's active display currency strictly following precedence:
 * authenticated profile -> cookie -> geo headers -> Accept-Language -> default currency.
 */
const resolveDefaultServerRequestCurrency = cache(async () => {
  return resolveServerRequestCurrencyUncached();
});

async function resolveServerRequestCurrencyUncached(options?: {
  overrideCode?: string | null;
}): Promise<{
  currency: PublicCurrencyDTO;
  baseCurrency: PublicCurrencyDTO;
  defaultCurrency: PublicCurrencyDTO;
  currencies: PublicCurrencyDTO[];
  source: "user" | "preference" | "geo" | "accept_language" | "default";
}> {
  const [{ currencies, baseCurrency, defaultCurrency }, session, cookieStore, hdrs] =
    await Promise.all([
      getCurrencyCatalogContext(),
      safeOptionalSession(),
      safeCookies(),
      safeHeaders(),
    ]);

  const cookieCode = cookieStore?.get(CURRENCY_COOKIE_NAME)?.value ?? null;
  const geoCountry =
    hdrs?.get("x-vercel-ip-country") ??
    hdrs?.get("cf-ipcountry") ??
    hdrs?.get("x-country-code") ??
    hdrs?.get("x-geo-country") ??
    null;
  const acceptLanguage = hdrs?.get("accept-language") ?? null;

  const resolved = resolveCurrencyFromContext({
    activeCurrencies: currencies,
    userPreference: options?.overrideCode ?? cookieCode ?? session?.user.preferredCurrency ?? null,
    cookieOrStoragePreference: cookieCode ?? session?.user.preferredCurrency ?? null,
    geoCountry,
    acceptLanguage,
  });

  // Strict precedence when explicit user account preference exists and no override requested:
  if (!options?.overrideCode) {
    const strictResolved = resolveCurrencyFromContext({
      activeCurrencies: currencies,
      userPreference: session?.user.preferredCurrency ?? null,
      cookieOrStoragePreference: cookieCode,
      geoCountry,
      acceptLanguage,
    });
    return {
      ...strictResolved,
      currencies,
      baseCurrency,
      defaultCurrency,
    };
  }

  return {
    ...resolved,
    currencies,
    baseCurrency,
    defaultCurrency,
  };
}

export async function getServerRequestCurrency(options?: {
  overrideCode?: string | null;
}): Promise<{
  currency: PublicCurrencyDTO;
  baseCurrency: PublicCurrencyDTO;
  defaultCurrency: PublicCurrencyDTO;
  currencies: PublicCurrencyDTO[];
  source: "user" | "preference" | "geo" | "accept_language" | "default";
}> {
  if (!options?.overrideCode) {
    return resolveDefaultServerRequestCurrency();
  }
  return resolveServerRequestCurrencyUncached(options);
}

export async function listAdminCurrencies(): Promise<{
  currencies: AdminCurrencyDTO[];
  rateHistory: CurrencyRateHistoryDTO[];
}> {
  const [rows, historyRows] = await Promise.all([
    db.currency.findMany({
      orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }, { code: "asc" }],
    }),
    db.currencyRateHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    currencies: rows.map((row) => ({
      ...mapCurrencyRow(row),
      createdAt: row.createdAt.toISOString(),
    })),
    rateHistory: historyRows.map((h) => ({
      id: h.id,
      currencyId: h.currencyId,
      currencyCode: h.currencyCode.trim().toUpperCase(),
      oldRate: h.oldRate.toFixed(8),
      newRate: h.newRate.toFixed(8),
      changedById: h.changedById,
      changedByEmail: h.changedByEmail,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export async function createAdminCurrency(
  input: CreateCurrencyInput,
  actor?: CurrencyActorInfo,
): Promise<AdminCurrencyDTO> {
  const code = input.code.trim().toUpperCase();
  const rateDec = new Decimal(input.exchangeRate);
  if (rateDec.lte(0)) {
    throw new ValidationError("Exchange rate must be greater than zero.");
  }

  if (input.isDefault && !input.isActive) {
    throw new ValidationError("Default currency must be active.");
  }

  const created = await db.$transaction(async (tx) => {
    const existingByCode = await tx.currency.findUnique({ where: { code } });
    if (existingByCode) {
      throw new ConflictError(`Currency ${code} already exists.`);
    }

    const existingBase = await tx.currency.findFirst({ where: { isBase: true } });
    if (input.isBase && existingBase) {
      throw new ConflictError(
        `Base currency is already set to ${existingBase.code}. Only one base currency is permitted.`,
      );
    }

    const effectiveIsBase = input.isBase || !existingBase;
    const effectiveRate = effectiveIsBase
      ? new Prisma.Decimal("1.00000000")
      : new Prisma.Decimal(rateDec.toFixed(8));
    if (input.isBase && !rateDec.equals(1)) {
      throw new ValidationError("Base currency exchange rate must equal 1.");
    }

    if (input.isDefault) {
      await tx.currency.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const row = await tx.currency.create({
      data: {
        code,
        name: input.name.trim(),
        symbol: input.symbol.trim(),
        symbolPosition: input.symbolPosition,
        decimalPlaces: input.decimalPlaces,
        roundingRule: input.roundingRule,
        exchangeRate: effectiveRate,
        isActive: effectiveIsBase || input.isDefault ? true : input.isActive,
        isDefault: input.isDefault || !existingBase,
        isBase: effectiveIsBase,
        sortOrder: input.sortOrder,
      },
    });

    await tx.currencyRateHistory.create({
      data: {
        currencyId: row.id,
        currencyCode: row.code,
        oldRate: effectiveRate,
        newRate: effectiveRate,
        changedById: actor?.id ?? null,
        changedByEmail: actor?.email ?? null,
        note: input.note ?? "Initial currency configuration",
      },
    });

    return row;
  });

  return {
    ...mapCurrencyRow(created),
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateAdminCurrency(
  id: string,
  input: Omit<UpdateCurrencyInput, "id">,
  actor?: CurrencyActorInfo,
): Promise<AdminCurrencyDTO> {
  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.currency.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Currency could not be found.");
    }

    const nextIsDefault = input.isDefault ?? existing.isDefault;
    const nextIsActive = input.isActive ?? existing.isActive;

    if (existing.isBase && input.isActive === false) {
      throw new ValidationError("Cannot deactivate the base currency.");
    }

    if (nextIsDefault && !nextIsActive) {
      throw new ValidationError(
        "Cannot deactivate the default currency. Select another active default currency first.",
      );
    }

    if (existing.isDefault && input.isDefault === false) {
      throw new ValidationError(
        "Storefront requires an active default currency. Activate and mark another currency as default instead.",
      );
    }

    let nextRate = existing.exchangeRate;
    if (input.exchangeRate !== undefined) {
      const rateDec = new Decimal(input.exchangeRate);
      if (rateDec.lte(0)) {
        throw new ValidationError("Exchange rate must be greater than zero.");
      }
      if (existing.isBase && !rateDec.equals(1)) {
        throw new ValidationError("Base currency exchange rate must remain equal to 1.");
      }
      nextRate = new Prisma.Decimal(rateDec.toFixed(8));
    }

    if (input.isDefault === true && !existing.isDefault) {
      await tx.currency.updateMany({
        where: { id: { not: existing.id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const row = await tx.currency.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.symbol !== undefined ? { symbol: input.symbol.trim() } : {}),
        ...(input.symbolPosition !== undefined ? { symbolPosition: input.symbolPosition } : {}),
        ...(input.decimalPlaces !== undefined ? { decimalPlaces: input.decimalPlaces } : {}),
        ...(input.roundingRule !== undefined ? { roundingRule: input.roundingRule } : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: nextRate } : {}),
        ...(input.isActive !== undefined ? { isActive: nextIsActive } : {}),
        ...(input.isDefault !== undefined ? { isDefault: nextIsDefault } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    const oldDec = new Decimal(existing.exchangeRate.toString());
    const newDec = new Decimal(nextRate.toString());
    if (!oldDec.equals(newDec)) {
      await tx.currencyRateHistory.create({
        data: {
          currencyId: row.id,
          currencyCode: row.code,
          oldRate: existing.exchangeRate,
          newRate: nextRate,
          changedById: actor?.id ?? null,
          changedByEmail: actor?.email ?? null,
          note: input.note ?? "Manual rate update",
        },
      });
    }

    return row;
  });

  return {
    ...mapCurrencyRow(updated),
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteAdminCurrency(id: string): Promise<{ id: string; code: string }> {
  const existing = await db.currency.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Currency could not be found.");
  }
  if (existing.isBase) {
    throw new ValidationError("Cannot delete the base currency.");
  }
  if (existing.isDefault) {
    throw new ValidationError(
      "Cannot delete the default currency. Assign another default currency first.",
    );
  }

  await db.currency.delete({ where: { id } });
  return { id: existing.id, code: existing.code };
}

export async function savePreferredCurrencyForVisitor(code: string, userId?: string | null) {
  const { currency } = await resolveActiveCurrencyByCode(code);
  if (currency.code !== code.trim().toUpperCase()) {
    throw new ValidationError(`Currency ${code} is not currently active.`);
  }

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { preferredCurrency: currency.code },
    });
  }

  return currency;
}
