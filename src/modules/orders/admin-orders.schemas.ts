import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/client";

export const adminUpdateOrderSchema = z
  .object({
    orderId: z.string().trim().min(2).max(64),
    toStatus: z.nativeEnum(OrderStatus),
    carrier: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    trackingNumber: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    trackingUrl: z
      .string()
      .trim()
      .max(400)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null))
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Tracking URL must start with http:// or https://.",
      ),
    internalNote: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    customerNote: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    notifyCustomer: z.boolean().default(false),
  })
  .strict();

export const adminRefundOrderSchema = z
  .object({
    orderId: z.string().trim().min(2).max(64),
    amount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid refund amount (up to 2 decimal places)."),
    reason: z.string().trim().min(3, "Provide a refund reason.").max(300),
    restoreStock: z.boolean().default(false),
    notifyCustomer: z.boolean().default(true),
  })
  .strict();

export const adminResendOrderEmailSchema = z
  .object({
    orderId: z.string().trim().min(2).max(64),
  })
  .strict();

export type AdminUpdateOrderInput = z.infer<typeof adminUpdateOrderSchema>;
export type AdminRefundOrderInput = z.infer<typeof adminRefundOrderSchema>;
export type AdminResendOrderEmailInput = z.infer<typeof adminResendOrderEmailSchema>;
