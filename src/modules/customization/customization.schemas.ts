import { z } from "zod";
import { MAX_CUSTOMIZATION_FILES } from "@/lib/constants";

export const customizationGroupTypeSchema = z.enum([
  "SELECT",
  "MULTI_SELECT",
  "SWATCH",
  "NUMBER_RANGE",
  "TEXT",
  "TEXTAREA",
  "IMAGE_UPLOAD",
]);

export const priceAdjustmentTypeSchema = z.enum(["NONE", "FIXED", "PERCENT"]);

export const customizationValidationRulesSchema = z
  .object({
    requiresStone: z.boolean().optional(),
    categoryKeywords: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    dependsOn: z
      .object({
        groupCode: z.string().trim().min(1).max(60),
        valuesIn: z.array(z.string().trim().min(1).max(60)).optional(),
        valuesNotIn: z.array(z.string().trim().min(1).max(60)).optional(),
      })
      .optional(),
  })
  .nullable()
  .optional();

export const optionValueInputSchema = z.object({
  id: z.string().trim().optional(),
  value: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Option value key must be alphanumeric/underscore/hyphen."),
  label: z.string().trim().min(1).max(120),
  swatchHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Swatch color must be a 6-digit hex code.")
    .nullable()
    .optional(),
  swatchImageUrl: z.string().trim().max(500).nullable().optional(),
  priceAdjustmentType: priceAdjustmentTypeSchema.default("NONE"),
  priceAdjustmentValue: z.union([z.number(), z.string()]).default("0"),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(500).default(0),
});

export const optionGroupInputSchema = z.object({
  id: z.string().trim().optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Group code must use lowercase letters, numbers, and underscores."),
  label: z.string().trim().min(1).max(120),
  type: customizationGroupTypeSchema,
  helperText: z.string().trim().max(300).nullable().optional(),
  placeholder: z.string().trim().max(160).nullable().optional(),
  required: z.boolean().default(false),
  minValue: z.union([z.number(), z.string()]).nullable().optional(),
  maxValue: z.union([z.number(), z.string()]).nullable().optional(),
  stepValue: z.union([z.number(), z.string()]).nullable().optional(),
  defaultValue: z.string().trim().max(120).nullable().optional(),
  maxLength: z.number().int().min(1).max(2000).nullable().optional(),
  maxFiles: z.number().int().min(1).max(MAX_CUSTOMIZATION_FILES).nullable().optional(),
  unit: z.string().trim().max(32).nullable().optional(),
  validationRules: customizationValidationRulesSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(500).default(0),
  values: z.array(optionValueInputSchema).max(60).default([]),
});

export const saveProductCustomizationConfigSchema = z.object({
  productId: z.string().trim().min(1),
  enabled: z.boolean(),
  inheritCategoryDefaults: z.boolean().default(true),
  minLeadTimeDays: z.number().int().min(1).max(365).nullable().optional(),
  disclaimerText: z.string().trim().max(1000).nullable().optional(),
  groups: z.array(optionGroupInputSchema).max(40).default([]),
});

export const saveCategoryCustomizationGroupsSchema = z.object({
  categoryId: z.string().trim().min(1),
  groups: z.array(optionGroupInputSchema).max(40),
});

export const applyPresetSchema = z.object({
  targetType: z.enum(["product", "category"]),
  targetId: z.string().trim().min(1),
  presetKey: z.enum(["rings", "necklaces", "earrings", "bracelets"]),
  replaceExisting: z.boolean().default(true),
});

export const submittedGroupInputSchema = z.object({
  value: z.string().max(1500).nullable().optional(),
  values: z.array(z.string().max(120)).max(40).nullable().optional(),
  numberValue: z.union([z.number(), z.string()]).nullable().optional(),
  textValue: z.string().max(1500).nullable().optional(),
  imageCount: z.number().int().min(0).max(MAX_CUSTOMIZATION_FILES).nullable().optional(),
});

export const uploadedImageInputSchema = z.object({
  storageKey: z.string().trim().min(1).max(240),
  thumbKey: z.string().trim().max(240).optional(),
  mimeType: z.string().trim().max(80).default("image/webp"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024)
    .default(1),
  width: z.number().int().positive().max(10000).nullable().optional(),
  height: z.number().int().positive().max(10000).nullable().optional(),
  originalName: z.string().trim().max(160).nullable().optional(),
});

export const sendGuestVerifyOtpSchema = z.object({
  email: z.string().trim().email().max(180),
});

export const verifyGuestOtpSchema = z.object({
  email: z.string().trim().email().max(180),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be 6 digits."),
});

export const createCustomizationRequestSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().nullable().optional(),
  selections: z.record(z.string().trim().min(1), submittedGroupInputSchema),
  uploadedImages: z.array(uploadedImageInputSchema).max(MAX_CUSTOMIZATION_FILES).default([]),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(180),
  customerPhone: z.string().trim().max(40).nullable().optional(),
  contactPreference: z.enum(["EMAIL", "PHONE"]).default("EMAIL"),
  preferredTimeline: z.string().trim().max(160).nullable().optional(),
  preferredDate: z.string().trim().max(40).nullable().optional(),
  customerNote: z.string().trim().max(2000).nullable().optional(),
  guestVerificationCode: z.string().trim().max(12).nullable().optional(),
});

export const editCustomizationRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  selections: z.record(z.string().trim().min(1), submittedGroupInputSchema),
  uploadedImages: z.array(uploadedImageInputSchema).max(MAX_CUSTOMIZATION_FILES).default([]),
  customerPhone: z.string().trim().max(40).nullable().optional(),
  contactPreference: z.enum(["EMAIL", "PHONE"]).default("EMAIL"),
  preferredTimeline: z.string().trim().max(160).nullable().optional(),
  preferredDate: z.string().trim().max(40).nullable().optional(),
  customerNote: z.string().trim().max(2000).nullable().optional(),
});

export const cancelCustomizationRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const duplicateCustomizationRequestSchema = z.object({
  requestId: z.string().trim().min(1),
});

export const acceptQuoteAsOrderSchema = z.object({
  requestId: z.string().trim().min(1).optional(),
  token: z.string().trim().min(16).max(256).optional(),
});

export const adminListCustomizationsSchema = z.object({
  status: z
    .enum([
      "ALL",
      "SUBMITTED",
      "IN_REVIEW",
      "ACCEPTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "ORDERED",
    ])
    .default("ALL"),
  search: z.string().trim().max(120).optional(),
  productId: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(["newest", "oldest", "quoted_high", "expiring_soon"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminEditSelectionsSchema = z.object({
  requestId: z.string().trim().min(1),
  selections: z.record(z.string().trim().min(1), submittedGroupInputSchema),
  internalNote: z.string().trim().max(4000).nullable().optional(),
});

export const adminAcceptQuoteSchema = z.object({
  requestId: z.string().trim().min(1),
  quotedPriceBase: z.coerce.number().positive().max(10_000_000),
  validityDays: z.coerce.number().int().min(1).max(90).default(7),
  estimatedDeliveryDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  adminMessage: z.string().trim().max(2000).nullable().optional(),
  internalNote: z.string().trim().max(4000).nullable().optional(),
});

export const adminRejectRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  rejectionReason: z.string().trim().min(3).max(1500),
  internalNote: z.string().trim().max(4000).nullable().optional(),
});

export const adminRequestInfoSchema = z.object({
  requestId: z.string().trim().min(1),
  message: z.string().trim().min(2).max(2000),
  internalNote: z.string().trim().max(4000).nullable().optional(),
});

export const adminUpdateRequestNoteSchema = z.object({
  requestId: z.string().trim().min(1),
  internalNote: z.string().trim().max(4000),
  status: z.enum(["SUBMITTED", "IN_REVIEW"]).optional(),
});
