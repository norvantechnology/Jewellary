import { z } from "zod";

export const ENQUIRY_TYPE_VALUES = ["BESPOKE", "PRODUCT", "GENERAL"] as const;
export const ENQUIRY_STATUS_VALUES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;

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

export const adminUpdateEnquirySchema = z
  .object({
    enquiryId: z.string().trim().min(2).max(64),
    status: z.enum(ENQUIRY_STATUS_VALUES),
    staffNote: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
  })
  .strict();

export const adminReplyEnquirySchema = z
  .object({
    enquiryId: z.string().trim().min(2).max(64),
    subject: z.string().trim().min(3, "Subject is required.").max(180),
    replyMessage: z.string().trim().min(5, "Reply message is required.").max(4000),
    nextStatus: z.enum(["IN_PROGRESS", "RESOLVED"]).default("RESOLVED"),
  })
  .strict();

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type AdminUpdateEnquiryInput = z.infer<typeof adminUpdateEnquirySchema>;
export type AdminReplyEnquiryInput = z.infer<typeof adminReplyEnquirySchema>;
