"use server";

import { revalidateTag, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE_NAME } from "@/lib/currency";
import {
  createCurrencySchema,
  deleteCurrencySchema,
  setPreferredCurrencySchema,
  updateCurrencySchema,
} from "@/modules/currencies/currency.schemas";
import {
  createAdminCurrency,
  deleteAdminCurrency,
  savePreferredCurrencyForVisitor,
  updateAdminCurrency,
  type AdminCurrencyDTO,
} from "@/modules/currencies/currency.service";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { isSecureRequestCookie } from "@/server/request-protocol";

function revalidateCurrencies() {
  updateTag(CACHE_TAGS.currencies);
  revalidateTag(CACHE_TAGS.currencies, "max");
  revalidateTag(CACHE_TAGS.settings, "max");
}

export const createCurrencyAction = createAction(
  {
    name: "currency.create",
    schema: createCurrencySchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "CURRENCY_CREATE",
      entityType: "Currency",
      entityId: (_input, res) => (res as AdminCurrencyDTO).id,
      after: (_input, res) => res,
    },
  },
  async (input, ctx): Promise<AdminCurrencyDTO> => {
    const created = await createAdminCurrency(input, {
      id: ctx.auth?.user.id,
      email: ctx.auth?.user.email,
    });
    revalidateCurrencies();
    return created;
  },
);

export const updateCurrencyAction = createAction(
  {
    name: "currency.update",
    schema: updateCurrencySchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "CURRENCY_UPDATE",
      entityType: "Currency",
      entityId: (input) => input.id,
      after: (_input, res) => res,
    },
  },
  async ({ id, ...rest }, ctx): Promise<AdminCurrencyDTO> => {
    const updated = await updateAdminCurrency(id, rest, {
      id: ctx.auth?.user.id,
      email: ctx.auth?.user.email,
    });
    revalidateCurrencies();
    return updated;
  },
);

export const deleteCurrencyAction = createAction(
  {
    name: "currency.delete",
    schema: deleteCurrencySchema,
    auth: { permission: "settings:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "CURRENCY_DELETE",
      entityType: "Currency",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const deleted = await deleteAdminCurrency(id);
    revalidateCurrencies();
    return deleted;
  },
);

export const setPreferredCurrencyAction = createAction(
  {
    name: "currency.setPreference",
    schema: setPreferredCurrencySchema,
    auth: "public",
    rateLimit: { tier: "publicCurrency" },
  },
  async ({ code }, ctx) => {
    const currency = await savePreferredCurrencyForVisitor(code, ctx.auth?.user.id ?? null);
    const [cookieStore, secureCookie] = await Promise.all([cookies(), isSecureRequestCookie()]);
    cookieStore.set(CURRENCY_COOKIE_NAME, currency.code, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: secureCookie,
    });
    return { code: currency.code, currency };
  },
);
