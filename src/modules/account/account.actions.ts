"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  changePasswordSchema,
  deleteAddressSchema,
  guestOrderLookupSchema,
  reorderOrderSchema,
  requestAccountDeletionSchema,
  saveAddressSchema,
  setDefaultAddressSchema,
  updateProfileSchema,
} from "@/modules/account/account.schemas";
import {
  anonymizeCustomerAccount,
  changeCustomerPassword,
  deleteCustomerAddress,
  reorderCustomerOrder,
  saveCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerProfile,
  verifyGuestOrderLookup,
} from "@/modules/account/account.service";
import { resolveCurrentCartOwner } from "@/modules/cart/cart.service";
import { assertHumanSubmission } from "@/server/abuse";
import { createAction } from "@/server/create-action";

export const updateProfileAction = createAction(
  {
    name: "account.updateProfile",
    schema: updateProfileSchema,
    auth: "required",
    rateLimit: { tier: "auth" },
  },
  async (input, { auth }) => {
    const hdrs = await headers();
    const updated = await updateCustomerProfile(auth!.user.id, input, hdrs);
    revalidatePath("/account");
    revalidatePath("/account/settings");
    return updated;
  },
);

export const changePasswordAction = createAction(
  {
    name: "account.changePassword",
    schema: changePasswordSchema,
    auth: "required",
    rateLimit: { tier: "auth" },
  },
  async (input) => {
    const hdrs = await headers();
    return changeCustomerPassword(input, hdrs);
  },
);

export const saveAddressAction = createAction(
  {
    name: "account.saveAddress",
    schema: saveAddressSchema,
    auth: "required",
  },
  async (input, { auth }) => {
    const saved = await saveCustomerAddress(auth!.user.id, input);
    revalidatePath("/account");
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return saved;
  },
);

export const deleteAddressAction = createAction(
  {
    name: "account.deleteAddress",
    schema: deleteAddressSchema,
    auth: "required",
  },
  async ({ addressId }, { auth }) => {
    const res = await deleteCustomerAddress(auth!.user.id, addressId);
    revalidatePath("/account");
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return res;
  },
);

export const setDefaultAddressAction = createAction(
  {
    name: "account.setDefaultAddress",
    schema: setDefaultAddressSchema,
    auth: "required",
  },
  async ({ addressId, kind }, { auth }) => {
    const res = await setDefaultCustomerAddress(auth!.user.id, addressId, kind);
    revalidatePath("/account");
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return res;
  },
);

export const requestAccountDeletionAction = createAction(
  {
    name: "account.deleteAccount",
    schema: requestAccountDeletionSchema,
    auth: "required",
    rateLimit: { tier: "auth" },
  },
  async ({ confirmEmail }, { auth }) => {
    const res = await anonymizeCustomerAccount(auth!.user.id, confirmEmail);
    revalidatePath("/account");
    return res;
  },
);

export const lookupGuestOrderAction = createAction(
  {
    name: "orders.guestLookup",
    schema: guestOrderLookupSchema,
    auth: "public",
    rateLimit: {
      tier: "guestOrderLookup",
      key: (_input, ctx) => `guestLookup:${ctx.ip}`,
    },
  },
  async (input, ctx) => {
    await assertHumanSubmission({
      website: input.website,
      timingToken: input.timingToken,
      turnstileToken: input.turnstileToken,
      ip: ctx.ip,
    });
    return verifyGuestOrderLookup(input);
  },
);

export const reorderOrderAction = createAction(
  {
    name: "orders.reorder",
    schema: reorderOrderSchema,
    auth: "public",
  },
  async (input, { auth }) => {
    const cartOwner = await resolveCurrentCartOwner(true);
    if (!cartOwner) {
      throw new Error("We couldn't load your cart. Please refresh the page.");
    }
    const result = await reorderCustomerOrder({
      orderNumber: input.orderNumber,
      guestToken: input.guestToken,
      actorUserId: auth?.user.id ?? null,
      actorRole: auth?.user.role ?? null,
      cartOwner,
    });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return result;
  },
);
