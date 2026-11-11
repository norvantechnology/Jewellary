import { z } from "zod";

export const ENQUIRY_TYPE_VALUES = ["BESPOKE", "PRODUCT", "GENERAL"] as const;

export const createEnquirySchema = z
  .object({
    type: z.enum(ENQUIRY_TYPE_VALUES).default("GENERAL"),
    name: z.string().trim().min(2, "Please provide your full name.").max(120),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(180),
    phone: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : null)),
    message: z
      .string()
      .trim()
      .min(
        10,
        "Please share a few details about what you are looking for (at least 10 characters).",
      )
      .max(2500),
    productId: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : null)),
    website: z.string().max(0, "Spam filter triggered.").optional().default(""),
  })
  .strict();

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
