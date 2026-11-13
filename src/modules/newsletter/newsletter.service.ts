import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NewsletterStatus, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { sendNewsletterConfirmationEmail } from "@/server/email/send";
import { logger } from "@/server/logger";

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface SubscribeNewsletterResult {
  status: "pending_confirmation" | "already_subscribed";
  email: string;
}

export async function requestNewsletterSubscription(input: {
  email: string;
  source: string;
}): Promise<SubscribeNewsletterResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({
    where: { email },
    select: { id: true, status: true, unsubscribeToken: true },
  });

  if (existing && existing.status === "CONFIRMED") {
    return { status: "already_subscribed", email };
  }

  const rawConfirmToken = randomBytes(24).toString("hex");
  const confirmTokenHash = hashToken(rawConfirmToken);
  const confirmTokenExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS);
  const unsubscribeToken = existing?.unsubscribeToken ?? randomBytes(16).toString("hex");
  const now = new Date();

  await db.newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      source: input.source,
      status: "PENDING",
      consentedAt: now,
      confirmTokenHash,
      confirmTokenExpiresAt,
      unsubscribeToken,
    },
    update: {
      source: input.source,
      status: "PENDING",
      consentedAt: now,
      verifiedAt: null,
      unsubscribedAt: null,
      confirmTokenHash,
      confirmTokenExpiresAt,
      unsubscribeToken,
    },
  });

  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const confirmUrl = `${baseUrl}/api/newsletter/confirm?token=${encodeURIComponent(rawConfirmToken)}`;
  const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  try {
    await sendNewsletterConfirmationEmail({
      to: email,
      confirmUrl,
      unsubscribeUrl,
    });
  } catch (err) {
    logger.warn(
      { email, err: err instanceof Error ? err.message : String(err) },
      "Newsletter double opt-in email dispatch failed",
    );
  }

  return { status: "pending_confirmation", email };
}

export async function confirmNewsletterSubscription(rawToken: string): Promise<{
  ok: boolean;
  status: "confirmed" | "invalid";
  email?: string;
}> {
  if (!rawToken || rawToken.trim().length < 16) {
    return { ok: false, status: "invalid" };
  }

  const tokenHash = hashToken(rawToken.trim());
  const row = await db.newsletterSubscriber.findFirst({
    where: {
      confirmTokenHash: tokenHash,
      confirmTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, email: true },
  });

  if (!row) {
    return { ok: false, status: "invalid" };
  }

  await db.newsletterSubscriber.update({
    where: { id: row.id },
    data: {
      status: "CONFIRMED",
      verifiedAt: new Date(),
      unsubscribedAt: null,
      confirmTokenHash: null,
      confirmTokenExpiresAt: null,
    },
  });

  return { ok: true, status: "confirmed", email: row.email };
}

export async function unsubscribeNewsletterByToken(unsubscribeToken: string): Promise<{
  ok: boolean;
  email?: string;
}> {
  if (!unsubscribeToken || unsubscribeToken.trim().length < 8) {
    return { ok: false };
  }

  const row = await db.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: unsubscribeToken.trim() },
    select: { id: true, email: true },
  });

  if (!row) {
    return { ok: false };
  }

  await db.newsletterSubscriber.update({
    where: { id: row.id },
    data: {
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date(),
      confirmTokenHash: null,
      confirmTokenExpiresAt: null,
    },
  });

  return { ok: true, email: row.email };
}

export interface AdminNewsletterSubscriberDTO {
  id: string;
  email: string;
  source: string | null;
  status: NewsletterStatus;
  consentedAt: string;
  verifiedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

export async function listAdminNewsletterSubscribers(params: {
  search?: string;
  status?: NewsletterStatus | "ALL";
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, params.pageSize ?? 20));
  const search = params.search?.trim();

  const where: Prisma.NewsletterSubscriberWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { source: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items, groupedCounts] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.newsletterSubscriber.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  let confirmedCount = 0;
  let pendingCount = 0;
  let unsubscribedCount = 0;
  for (const g of groupedCounts) {
    if (g.status === "CONFIRMED") confirmedCount = g._count._all;
    else if (g.status === "PENDING") pendingCount = g._count._all;
    else if (g.status === "UNSUBSCRIBED") unsubscribedCount = g._count._all;
  }

  return {
    items: items.map((row): AdminNewsletterSubscriberDTO => ({
      id: row.id,
      email: row.email,
      source: row.source,
      status: row.status,
      consentedAt: row.consentedAt.toISOString(),
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: {
      confirmed: confirmedCount,
      pending: pendingCount,
      unsubscribed: unsubscribedCount,
    },
  };
}
