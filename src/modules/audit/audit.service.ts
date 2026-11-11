import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export interface AuditLogEntryDTO {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export async function listAuditLogs(params: {
  page?: number;
  pageSize?: number;
  actorEmail?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  logs: AuditLogEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  entityTypes: string[];
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const where: Prisma.AuditLogWhereInput = {
    ...(params.actorEmail?.trim()
      ? { actorEmail: { contains: params.actorEmail.trim(), mode: "insensitive" } }
      : {}),
    ...(params.action?.trim()
      ? { action: { contains: params.action.trim(), mode: "insensitive" } }
      : {}),
    ...(params.entityType?.trim() && params.entityType !== "ALL"
      ? { entityType: params.entityType.trim() }
      : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows, distinctEntities] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      take: 30,
    }),
  ]);

  return {
    logs: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    entityTypes: distinctEntities.map((e) => e.entityType),
  };
}
