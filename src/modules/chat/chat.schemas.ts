import { z } from "zod";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";

export const chatContextTypeEnum = z.enum(["GENERAL", "PRODUCT", "CUSTOMIZATION_REQUEST", "ORDER"]);

export const chatMessageTypeEnum = z.enum(["TEXT", "IMAGE", "PRODUCT", "REQUEST", "ORDER"]);

export const conversationStatusEnum = z.enum(["OPEN", "RESOLVED", "CLOSED"]);

export const startConversationSchema = z.object({
  contextType: chatContextTypeEnum.default("GENERAL"),
  contextRefId: z.string().trim().min(1).max(120).optional().nullable(),
  guestEmail: z.string().trim().email("Please enter a valid email address.").optional().nullable(),
  guestName: z.string().trim().min(1).max(80).optional().nullable(),
  initialMessage: z.string().trim().max(2000).optional().nullable(),
});

export const chatAttachmentInputSchema = z.object({
  storageKey: z.string().trim().min(1).max(240),
  thumbKey: z.string().trim().min(1).max(240).optional(),
  mimeType: z.string().trim().max(60).optional(),
  sizeBytes: z.number().int().positive().max(MAX_CUSTOMER_IMAGE_UPLOAD_BYTES),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  originalName: z.string().trim().max(120).optional(),
});

export const sendMessageSchema = z
  .object({
    conversationId: z.string().trim().min(1).max(120),
    type: chatMessageTypeEnum.default("TEXT"),
    body: z.string().max(2000).default(""),
    clientTempId: z.string().trim().min(4).max(100).optional(),
    refId: z.string().trim().min(1).max(120).optional().nullable(),
    attachments: z.array(chatAttachmentInputSchema).max(5).optional(),
  })
  .superRefine((val, ctx) => {
    const trimmed = val.body.trim();
    const hasAttachments = Boolean(val.attachments && val.attachments.length > 0);
    const isCardType = val.type === "PRODUCT" || val.type === "REQUEST" || val.type === "ORDER";

    if (isCardType && !val.refId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A referenced item ID is required when sharing a card.",
        path: ["refId"],
      });
    }

    if (!trimmed && !hasAttachments && !isCardType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message cannot be empty.",
        path: ["body"],
      });
    }
  });

export const markReadSchema = z.object({
  conversationId: z.string().trim().min(1).max(120),
  lastReadSeq: z.number().int().nonnegative().optional(),
});

export const adminListConversationsSchema = z.object({
  status: z.enum(["ALL", "OPEN", "RESOLVED", "CLOSED"]).default("ALL"),
  assignedToId: z.string().trim().default("ALL"),
  contextType: z
    .enum(["ALL", "GENERAL", "PRODUCT", "CUSTOMIZATION_REQUEST", "ORDER"])
    .default("ALL"),
  tag: z.string().trim().max(60).optional(),
  unreadOnly: z.coerce.boolean().optional().default(false),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminUpdateConversationSchema = z.object({
  conversationId: z.string().trim().min(1).max(120),
  status: conversationStatusEnum.optional(),
  assignedToId: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export const adminAddNoteSchema = z.object({
  conversationId: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1, "Note cannot be empty.").max(2000),
});

export const adminCannedReplySchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(80),
  category: z.string().trim().max(60).optional().nullable(),
  body: z.string().trim().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
