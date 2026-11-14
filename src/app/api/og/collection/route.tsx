import type { NextRequest } from "next/server";
import { fill } from "@/lib/fill-text";
import { loadOgPhoto, ogJpegResponse } from "@/lib/seo/og-image";
import { getActiveBanners } from "@/modules/banners/banner.service";
import { resolveCategoryByPath } from "@/modules/catalog/catalog.public";
import { getActiveLandingFacet } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent } from "@/modules/site-content/site-content.service";

/**
 * Share image for /collections and /collections/<category>[/<style>]: category photo
 * (or the home hero photo) + collection name (1200x630 JPEG).
 */
export async function GET(request: NextRequest) {
  const segments = (request.nextUrl.searchParams.get("path") ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const [settings, content, banners] = await Promise.all([
    getPublicStoreSettings(),
    getSiteContent(),
    getActiveBanners().catch(() => []),
  ]);
  const copy = content.pages.collections;
  let title = copy.heading;
  let subtitle: string | null = copy.intro;
  let highlight: string | null = null;
  let photoSrc: string | null = banners.find((b) => b.position === "HERO")?.imageUrl ?? null;

  if (segments.length > 0) {
    const resolved = await resolveCategoryByPath(segments.join("/")).catch(() => null);
    if (resolved?.kind === "category") {
      title = resolved.category.name;
      subtitle = resolved.category.description || subtitle;
      highlight = fill(copy.shareCountLabel, { count: resolved.category.productCount });
      photoSrc = resolved.category.ogImageUrl || resolved.category.imageUrl || photoSrc;
    } else if (segments.length >= 2) {
      const facet = await getActiveLandingFacet(
        segments.slice(0, -1).join("/"),
        segments[segments.length - 1]!,
      ).catch(() => null);
      if (facet) {
        title = facet.h1 || facet.name;
        subtitle = facet.introCopy || subtitle;
      }
    }
  }

  return ogJpegResponse({
    brand: settings.storeName,
    title,
    subtitle,
    highlight,
    photo: await loadOgPhoto(photoSrc, 600, 630),
  });
}
