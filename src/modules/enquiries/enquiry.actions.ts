"use server";

import { revalidatePath } from "next/cache";
import { createEnquirySchema } from "@/modules/enquiries/enquiry.schemas";
import { createCustomerEnquiry } from "@/modules/enquiries/enquiry.service";
import { createAction } from "@/server/create-action";

export const submitEnquiryAction = createAction(
  {
    name: "enquiry.submit",
    schema: createEnquirySchema,
    auth: "public",
    rateLimit: { tier: "enquiry" },
  },
  async (input, ctx) => {
    const created = await createCustomerEnquiry(input, ctx.auth?.user.id ?? null);
    revalidatePath("/admin/enquiries");
    return created;
  },
);
