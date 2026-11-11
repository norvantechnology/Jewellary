import "@/lib/zod-csp";
import { z } from "zod";
import { checkoutAddressSchema } from "@/modules/orders/order.schemas";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
    phone: z
      .string()
      .trim()
      .max(32, "Phone number cannot exceed 32 characters.")
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(128),
    newPassword: z
      .string()
      .min(10, "New password must be at least 10 characters.")
      .max(128, "New password cannot exceed 128 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password.").max(128),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password confirmation does not match.",
        path: ["confirmPassword"],
      });
    }
    if (val.newPassword === val.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password must differ from your current password.",
        path: ["newPassword"],
      });
    }
  });

export const saveAddressSchema = checkoutAddressSchema
  .extend({
    id: z.string().trim().min(2).max(64).optional().nullable(),
    label: z
      .string()
      .trim()
      .max(60)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    isDefaultShipping: z.boolean().optional().default(false),
    isDefaultBilling: z.boolean().optional().default(false),
  })
  .strict();

export const deleteAddressSchema = z
  .object({
    addressId: z.string().trim().min(2).max(64),
  })
  .strict();

export const setDefaultAddressSchema = z
  .object({
    addressId: z.string().trim().min(2).max(64),
    kind: z.enum(["shipping", "billing"]),
  })
  .strict();

export const requestAccountDeletionSchema = z
  .object({
    confirmEmail: z.string().trim().email("Enter your account email address to confirm."),
  })
  .strict();

export const guestOrderLookupSchema = z
  .object({
    orderNumber: z
      .string()
      .trim()
      .min(4, "Order number is required.")
      .max(32)
      .transform((val) => val.toUpperCase()),
    email: z
      .string()
      .trim()
      .email("Enter the email address used for the order.")
      .max(160)
      .transform((val) => val.toLowerCase()),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SaveAddressInput = z.infer<typeof saveAddressSchema>;
export type DeleteAddressInput = z.infer<typeof deleteAddressSchema>;
export type SetDefaultAddressInput = z.infer<typeof setDefaultAddressSchema>;
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
export type GuestOrderLookupInput = z.infer<typeof guestOrderLookupSchema>;
