"use server";

import { revalidatePath } from "next/cache";
import {
  adminReplyEnquirySchema,
  adminUpdateEnquirySchema,
  createEnquirySchema,
} from "@/modules/enquiries/enquiry.schemas";
import {
  createCustomerEnquiry,
  replyToAdminEnquiry,
  updateAdminEnquiry,
} from "@/modules/enquiries/enquiry.service";
import { assertHumanSubmission } from "@/server/abuse";
import { createAction } from "@/server/create-action";

export const submitEnquiryAction = createAction(
  {
    name: "enquiry.submit",
    schema: createEnquirySchema,
    auth: "public",
    rateLimit: { tier: "enquiry" },
  },
  async (input, ctx) => {
    await assertHumanSubmission({
      website: input.website,
      timingToken: input.timingToken,
      turnstileToken: input.turnstileToken,
      ip: ctx.ip,
    });
    const created = await createCustomerEnquiry(input, ctx.auth?.user.id ?? null);
    revalidatePath("/admin/enquiries");
    revalidatePath("/admin");
    return created;
  },
);

export const adminUpdateEnquiryAction = createAction(
  {
    name: "admin.enquiries.update",
    schema: adminUpdateEnquirySchema,
    auth: { permission: "enquiries:manage" },
    rateLimit: { tier: "adminWrite" },
  },
  async (input, { auth }) => {
    const res = await updateAdminEnquiry(input, auth!);
    revalidatePath("/admin/enquiries");
    revalidatePath("/admin");
    return res;
  },
);

export const adminReplyEnquiryAction = createAction(
  {
    name: "admin.enquiries.reply",
    schema: adminReplyEnquirySchema,
    auth: { permission: "enquiries:manage" },
    rateLimit: { tier: "adminWrite" },
  },
  async (input, { auth }) => {
    const res = await replyToAdminEnquiry(input, auth!);
    revalidatePath("/admin/enquiries");
    revalidatePath("/admin");
    return res;
  },
);
