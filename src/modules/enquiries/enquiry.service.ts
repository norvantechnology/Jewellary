import "server-only";
import type { EnquiryType } from "@/generated/prisma/client";
import type { CreateEnquiryInput } from "@/modules/enquiries/enquiry.schemas";
import { db } from "@/server/db";
import { sendEnquiryNotificationEmails } from "@/server/email/send";
import { NotFoundError } from "@/server/errors";
import { logger } from "@/server/logger";

export interface SubmittedEnquiryDTO {
  id: string;
  type: EnquiryType;
  status: string;
  productName: string | null;
  createdAt: string;
}

export async function createCustomerEnquiry(
  input: CreateEnquiryInput,
  userId?: string | null,
): Promise<SubmittedEnquiryDTO> {
  let productName: string | null = null;
  if (input.productId) {
    const product = await db.product.findFirst({
      where: {
        id: input.productId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new NotFoundError("Referenced jewellery piece was not found.");
    }
    productName = product.name;
  }

  const enquiry = await db.enquiry.create({
    data: {
      type: input.type,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      message: input.message,
      productId: input.productId ?? null,
      userId: userId ?? null,
    },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
    },
  });

  try {
    await sendEnquiryNotificationEmails({
      customerName: input.name,
      customerEmail: input.email,
      enquiryType: input.type,
      productName,
      message: input.message,
    });
  } catch (error) {
    logger.warn(
      {
        enquiryId: enquiry.id,
        err: error instanceof Error ? error.message : String(error),
      },
      "Enquiry email dispatch failed; enquiry persisted safely in database",
    );
  }

  return {
    id: enquiry.id,
    type: enquiry.type,
    status: enquiry.status,
    productName,
    createdAt: enquiry.createdAt.toISOString(),
  };
}
