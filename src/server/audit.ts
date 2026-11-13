import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { getClientIp, getClientUserAgent } from "@/server/rate-limit";

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "secret",
  "apikey",
  "guestlookuptokenhash",
  "accesstoken",
  "refreshtoken",
  "idtoken",
]);

export function sanitizeAuditPayload(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditPayload(item) ?? null);
  }
  if (typeof value === "object") {
    // Handle Decimal objects cleanly
    if (
      "toFixed" in value &&
      typeof (value as { toFixed?: unknown }).toFixed === "function" &&
      "toString" in value
    ) {
      return String(value);
    }
    const clean: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, val] of Object.entries(value)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = sanitizeAuditPayload(val) ?? null;
      }
    }
    return clean;
  }
  return String(value);
}

export interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const [ipAddress, userAgent] = await Promise.all([
      input.ipAddress !== undefined ? Promise.resolve(input.ipAddress) : getClientIp(),
      input.userAgent !== undefined ? Promise.resolve(input.userAgent) : getClientUserAgent(),
    ]);

    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: sanitizeAuditPayload(input.before),
        after: sanitizeAuditPayload(input.after),
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error(
      {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        err: error instanceof Error ? error.message : String(error),
      },
      "Failed to write audit log",
    );
  }
}
