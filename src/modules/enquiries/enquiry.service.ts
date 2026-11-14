import "server-only";
import { telegramAlerts } from "@/server/telegram";
import type { EnquiryStatus, EnquiryType, Prisma } from "@/generated/prisma/client";
import type {
  AdminReplyEnquiryInput,
  AdminUpdateEnquiryInput,
  CreateEnquiryInput,
} from "@/modules/enquiries/enquiry.schemas";
import { writeAuditLog } from "@/server/audit";
import type { AuthenticatedContext } from "@/server/dal";
import { db } from "@/server/db";
import { sendEnquiryNotificationEmails, sendEnquiryReplyEmail } from "@/server/email/send";
import { NotFoundError } from "@/server/errors";
import { logger } from "@/server/logger";

export interface SubmittedEnquiryDTO {
  id: string;
  type: EnquiryType;
  status: string;
  productName: string | null;
  createdAt: string;
}

export interface AdminEnquiryDTO {
  id: string;
  type: EnquiryType;
  status: EnquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  staffNote: string | null;
  assignedTo: string | null;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  createdAt: string;
  updatedAt: string;
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
      throw new NotFoundError("We couldn't find that item.");
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

  telegramAlerts.inquiry({
    id: enquiry.id,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    type: input.type,
    productName,
    message: input.message,
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

export async function listAdminEnquiries(params: {
  page?: number;
  pageSize?: number;
  status?: EnquiryStatus | "ALL";
  q?: string;
}): Promise<{
  enquiries: AdminEnquiryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  openCount: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const q = params.q?.trim();

  const where: Prisma.EnquiryWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { message: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, openCount, rows] = await Promise.all([
    db.enquiry.count({ where }),
    db.enquiry.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    db.enquiry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { name: true, slug: true } },
      },
    }),
  ]);

  return {
    enquiries: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      staffNote: row.staffNote,
      assignedTo: row.assignedTo,
      productId: row.productId,
      productName: row.product?.name ?? null,
      productSlug: row.product?.slug ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    openCount,
  };
}

export async function updateAdminEnquiry(
  input: AdminUpdateEnquiryInput,
  actor: AuthenticatedContext,
) {
  const existing = await db.enquiry.findUnique({ where: { id: input.enquiryId } });
  if (!existing) {
    throw new NotFoundError("Inquiry not found.");
  }

  const updated = await db.enquiry.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      staffNote: input.staffNote ?? null,
      assignedTo: existing.assignedTo ?? actor.user.email,
    },
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: "enquiry.updated",
    entityType: "Enquiry",
    entityId: updated.id,
    before: { status: existing.status, staffNote: existing.staffNote },
    after: { status: updated.status, staffNote: updated.staffNote },
  });

  return {
    id: updated.id,
    status: updated.status,
    staffNote: updated.staffNote,
  };
}

export async function replyToAdminEnquiry(
  input: AdminReplyEnquiryInput,
  actor: AuthenticatedContext,
) {
  const existing = await db.enquiry.findUnique({
    where: { id: input.enquiryId },
    include: { product: { select: { name: true } } },
  });

  if (!existing) {
    throw new NotFoundError("Inquiry not found.");
  }

  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[Reply ${timestamp} by ${actor.user.email} — "${input.subject}"]\n${input.replyMessage}`;
  const combinedNote = existing.staffNote ? `${existing.staffNote}\n\n${entry}` : entry;

  let emailDelivered = false;
  try {
    await sendEnquiryReplyEmail({
      to: existing.email,
      recipientName: existing.name,
      subject: input.subject,
      enquiryType: existing.type,
      replyMessage: input.replyMessage,
      productName: existing.product?.name ?? null,
    });
    emailDelivered = true;
  } catch (error) {
    logger.warn(
      {
        enquiryId: existing.id,
        err: error instanceof Error ? error.message : String(error),
      },
      "Enquiry reply email failed; recording staff response note in database",
    );
  }

  const updated = await db.enquiry.update({
    where: { id: existing.id },
    data: {
      status: input.nextStatus,
      staffNote: combinedNote,
      assignedTo: actor.user.email,
    },
  });

  await writeAuditLog({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    actorRole: actor.user.role,
    action: "enquiry.replied",
    entityType: "Enquiry",
    entityId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status, subject: input.subject, emailDelivered },
  });

  return {
    id: updated.id,
    status: updated.status,
    staffNote: updated.staffNote,
    emailDelivered,
  };
}
