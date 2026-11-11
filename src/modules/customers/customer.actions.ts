"use server";

import { revalidatePath } from "next/cache";
import { changeCustomerRoleSchema } from "@/modules/customers/customer.schemas";
import { changeCustomerRole } from "@/modules/customers/customer.service";
import { createAction } from "@/server/create-action";

export const adminChangeCustomerRoleAction = createAction(
  {
    name: "admin.customers.changeRole",
    schema: changeCustomerRoleSchema,
    auth: { permission: "customers:change_role" },
    rateLimit: { tier: "adminWrite" },
  },
  async (input, { auth }) => {
    const res = await changeCustomerRole(input, auth!);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${input.userId}`);
    revalidatePath("/admin/audit-log");
    return res;
  },
);
