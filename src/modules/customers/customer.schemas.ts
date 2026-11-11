import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";

export const changeCustomerRoleSchema = z
  .object({
    userId: z.string().trim().min(2).max(64),
    role: z.nativeEnum(UserRole),
    reason: z
      .string()
      .trim()
      .max(300)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict();

export type ChangeCustomerRoleInput = z.infer<typeof changeCustomerRoleSchema>;
