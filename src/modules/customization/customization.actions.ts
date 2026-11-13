"use server";

import { resolveActorIdentity } from "@/server/customer-identity";
import { getOrCreateGuestTokenCookie } from "@/server/guest-token";
import { createAction } from "@/server/create-action";
import { getServerRequestCurrency } from "@/modules/currencies/currency.service";
import {
  acceptQuoteAsOrderSchema,
  adminAcceptQuoteSchema,
  adminEditSelectionsSchema,
  adminRejectRequestSchema,
  adminRequestInfoSchema,
  adminUpdateRequestNoteSchema,
  applyPresetSchema,
  cancelCustomizationRequestSchema,
  createCustomizationRequestSchema,
  duplicateCustomizationRequestSchema,
  editCustomizationRequestSchema,
  saveCategoryCustomizationGroupsSchema,
  saveProductCustomizationConfigSchema,
  sendGuestVerifyOtpSchema,
  verifyGuestOtpSchema,
} from "@/modules/customization/customization.schemas";
import {
  adminAcceptCustomizationQuote,
  adminEditRequestSelections,
  adminRejectCustomizationRequest,
  adminRequestMoreInfo,
  adminUpdateCustomizationInternalNote,
  applyCustomizationPreset,
  cancelCustomizationRequest,
  consumeQuoteTokenAndAddToBag,
  createCustomizationRequest,
  duplicateCustomizationRequest,
  editSubmittedCustomizationRequest,
  saveCategoryCustomizationGroups,
  saveProductCustomizationConfig,
  sendGuestCustomizationVerificationOtp,
  verifyGuestCustomizationOtp,
} from "@/modules/customization/customization.service";

export const adminSaveProductCustomizationAction = createAction(
  {
    name: "customization.adminSaveProductConfig",
    auth: { permission: "customization:manage" },
    schema: saveProductCustomizationConfigSchema,
  },
  async (input, ctx) => {
    return saveProductCustomizationConfig(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminSaveCategoryCustomizationAction = createAction(
  {
    name: "customization.adminSaveCategoryGroups",
    auth: { permission: "customization:manage" },
    schema: saveCategoryCustomizationGroupsSchema,
  },
  async (input, ctx) => {
    await saveCategoryCustomizationGroups(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
    return { saved: true };
  },
);

export const adminApplyCustomizationPresetAction = createAction(
  {
    name: "customization.adminApplyPreset",
    auth: { permission: "customization:manage" },
    schema: applyPresetSchema,
  },
  async (input, ctx) => {
    return applyCustomizationPreset(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const sendGuestCustomizationOtpAction = createAction(
  {
    name: "customization.sendGuestOtp",
    schema: sendGuestVerifyOtpSchema,
  },
  async (input) => {
    const guestToken = await getOrCreateGuestTokenCookie();
    return sendGuestCustomizationVerificationOtp(input.email, guestToken);
  },
);

export const verifyGuestCustomizationOtpAction = createAction(
  {
    name: "customization.verifyGuestOtp",
    schema: verifyGuestOtpSchema,
  },
  async (input) => {
    const guestToken = await getOrCreateGuestTokenCookie();
    return verifyGuestCustomizationOtp(input.email, input.code, guestToken);
  },
);

export const createCustomizationRequestAction = createAction(
  {
    name: "customization.createRequest",
    schema: createCustomizationRequestSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const currencyCtx = await getServerRequestCurrency();
    return createCustomizationRequest(input, actor, currencyCtx.currency.code);
  },
);

export const editCustomizationRequestAction = createAction(
  {
    name: "customization.editRequest",
    schema: editCustomizationRequestSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    return editSubmittedCustomizationRequest(input, actor);
  },
);

export const cancelCustomizationRequestAction = createAction(
  {
    name: "customization.cancelRequest",
    schema: cancelCustomizationRequestSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    return cancelCustomizationRequest(input, actor);
  },
);

export const duplicateCustomizationRequestAction = createAction(
  {
    name: "customization.duplicateRequest",
    schema: duplicateCustomizationRequestSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    const currencyCtx = await getServerRequestCurrency();
    return duplicateCustomizationRequest(input, actor, currencyCtx.currency.code);
  },
);

export const acceptCustomizationQuoteToBagAction = createAction(
  {
    name: "customization.acceptQuoteToBag",
    schema: acceptQuoteAsOrderSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    return consumeQuoteTokenAndAddToBag(input, actor);
  },
);

export const adminEditCustomizationSelectionsAction = createAction(
  {
    name: "customization.adminEditSelections",
    auth: { permission: "customization:manage" },
    schema: adminEditSelectionsSchema,
  },
  async (input, ctx) => {
    return adminEditRequestSelections(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminAcceptCustomizationQuoteAction = createAction(
  {
    name: "customization.adminAcceptQuote",
    auth: { permission: "customization:manage" },
    schema: adminAcceptQuoteSchema,
  },
  async (input, ctx) => {
    return adminAcceptCustomizationQuote(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminRejectCustomizationRequestAction = createAction(
  {
    name: "customization.adminRejectRequest",
    auth: { permission: "customization:manage" },
    schema: adminRejectRequestSchema,
  },
  async (input, ctx) => {
    return adminRejectCustomizationRequest(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminRequestCustomizationInfoAction = createAction(
  {
    name: "customization.adminRequestInfo",
    auth: { permission: "customization:manage" },
    schema: adminRequestInfoSchema,
  },
  async (input, ctx) => {
    return adminRequestMoreInfo(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      name: ctx.auth!.user.name ?? null,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminUpdateCustomizationNoteAction = createAction(
  {
    name: "customization.adminUpdateNote",
    auth: { permission: "customization:manage" },
    schema: adminUpdateRequestNoteSchema,
  },
  async (input, ctx) => {
    return adminUpdateCustomizationInternalNote(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);
