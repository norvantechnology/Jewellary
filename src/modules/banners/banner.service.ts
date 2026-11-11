import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export interface BannerDTO {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  altText: string;
  position: "HERO" | "STRIP" | "EDITORIAL";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
}

export async function listAllBanners(): Promise<BannerDTO[]> {
  const rows = await db.banner.findMany({
    orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    altText: b.altText,
    position: b.position,
    isActive: b.isActive,
    startsAt: b.startsAt ? b.startsAt.toISOString() : null,
    endsAt: b.endsAt ? b.endsAt.toISOString() : null,
    sortOrder: b.sortOrder,
  }));
}

export async function getActiveBanners(): Promise<BannerDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.banners);

  const now = new Date();
  const rows = await db.banner.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    altText: b.altText,
    position: b.position,
    isActive: b.isActive,
    startsAt: b.startsAt ? b.startsAt.toISOString() : null,
    endsAt: b.endsAt ? b.endsAt.toISOString() : null,
    sortOrder: b.sortOrder,
  }));
}
