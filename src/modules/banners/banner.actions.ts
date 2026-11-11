"use server";

import { revalidateTag, updateTag } from "next/cache";
import { bannerUpsertSchema, deleteBannerSchema } from "@/modules/banners/banner.schemas";
import { CACHE_TAGS } from "@/server/cache-tags";
import { createAction } from "@/server/create-action";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const upsertBannerAction = createAction(
  {
    name: "banner.upsert",
    schema: bannerUpsertSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "BANNER_UPSERT",
      entityType: "Banner",
      entityId: (_input, res: { id: string }) => res.id,
    },
  },
  async (input) => {
    const data = {
      title: input.title,
      subtitle: input.subtitle || null,
      ctaLabel: input.ctaLabel || null,
      ctaHref: input.ctaHref || null,
      imageUrl: input.imageUrl,
      mobileImageUrl: input.mobileImageUrl || null,
      altText: input.altText,
      position: input.position,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      sortOrder: input.sortOrder,
    };

    const banner = input.id
      ? await db.banner.update({ where: { id: input.id }, data })
      : await db.banner.create({ data });

    updateTag(CACHE_TAGS.banners);
    revalidateTag(CACHE_TAGS.banners, "max");

    return { id: banner.id, title: banner.title };
  },
);

export const deleteBannerAction = createAction(
  {
    name: "banner.delete",
    schema: deleteBannerSchema,
    auth: { permission: "content:manage" },
    rateLimit: { tier: "adminWrite" },
    audit: {
      action: "BANNER_DELETE",
      entityType: "Banner",
      entityId: (input) => input.id,
    },
  },
  async ({ id }) => {
    const existing = await db.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Banner not found.");
    await db.banner.delete({ where: { id } });

    updateTag(CACHE_TAGS.banners);
    revalidateTag(CACHE_TAGS.banners, "max");
    return { id };
  },
);
