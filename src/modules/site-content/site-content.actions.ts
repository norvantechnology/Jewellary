"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { stripNonEditable, validateSiteContent } from "@/modules/site-content/site-content.shared";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";

function refreshStorefront() {
  updateTag(CACHE_TAGS.siteContent);
  revalidatePath("/", "layout");
}

export const saveSiteContentAction = createAction(
  {
    name: "siteContent.save",
    schema: z.object({ content: z.record(z.string(), z.unknown()) }),
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: { action: "SITE_CONTENT_UPDATE", entityType: "SiteContent", entityId: () => "default" },
  },
  async ({ content: submitted }, ctx) => {
    // Comments ("_" keys) and the file-only siteConfig section are never stored.
    const content = stripNonEditable(submitted) as Record<string, unknown>;
    const errors = validateSiteContent(content);
    if (errors.length > 0) {
      throw new ValidationError(`Content not saved: ${errors.slice(0, 5).join("; ")}`);
    }
    const saved = await db.siteContent.upsert({
      where: { id: "default" },
      update: { data: content as Prisma.InputJsonValue, updatedById: ctx.auth?.user.id ?? null },
      create: {
        id: "default",
        data: content as Prisma.InputJsonValue,
        updatedById: ctx.auth?.user.id ?? null,
      },
    });
    refreshStorefront();
    return { updatedAt: saved.updatedAt.toISOString() };
  },
);

export const resetSiteContentAction = createAction(
  {
    name: "siteContent.reset",
    schema: z.object({}),
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: { action: "SITE_CONTENT_RESET", entityType: "SiteContent", entityId: () => "default" },
  },
  async () => {
    await db.siteContent.deleteMany({ where: { id: "default" } });
    refreshStorefront();
    return { reset: true };
  },
);
