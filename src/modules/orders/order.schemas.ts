import { z } from "zod";

export const checkoutAddressSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required.").max(120),
    phone: z.string().trim().min(6, "Contact phone number is required.").max(32),
    line1: z.string().trim().min(3, "Street address is required.").max(180),
    line2: z
      .string()
      .trim()
      .max(180)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    city: z.string().trim().min(2, "City is required.").max(100),
    state: z.string().trim().min(1, "State / Province is required.").max(100),
    postalCode: z.string().trim().min(2, "Postal / ZIP code is required.").max(24),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Select a valid 2-letter destination country."),
  })
  .strict();

export const quoteCheckoutSchema = z
  .object({
    shippingCountry: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Valid 2-letter country code required."),
    shippingZoneId: z.string().trim().min(2).max(64).optional().nullable(),
  })
  .strict();

export const createCheckoutOrderSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address for order receipts.").max(160),
    shippingAddress: checkoutAddressSchema,
    billingSameAsShipping: z.boolean().default(true),
    billingAddress: checkoutAddressSchema.optional().nullable(),
    shippingZoneId: z.string().trim().min(2).max(64).optional().nullable(),
    giftNote: z
      .string()
      .trim()
      .max(300)
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
    saveAddressToAccount: z.boolean().optional().default(false),
    idempotencyKey: z.string().trim().min(8).max(120),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.billingSameAsShipping && !val.billingAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Billing address is required when different from shipping address.",
        path: ["billingAddress"],
      });
    }
  });

export const retryOrderPaymentSchema = z
  .object({
    orderNumber: z.string().trim().min(6).max(32),
    guestToken: z.string().trim().min(8).max(128).optional().nullable(),
  })
  .strict();

export const confirmSandboxPaymentSchema = z
  .object({
    orderNumber: z.string().trim().min(6).max(32),
    outcome: z.enum(["succeed", "fail"]),
    guestToken: z.string().trim().min(8).max(128).optional().nullable(),
  })
  .strict();

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
export type QuoteCheckoutInput = z.infer<typeof quoteCheckoutSchema>;
export type CreateCheckoutOrderInput = z.infer<typeof createCheckoutOrderSchema>;
export type RetryOrderPaymentInput = z.infer<typeof retryOrderPaymentSchema>;
export type ConfirmSandboxPaymentInput = z.infer<typeof confirmSandboxPaymentSchema>;
