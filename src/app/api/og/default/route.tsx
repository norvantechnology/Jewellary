import { loadOgPhoto, ogJpegResponse } from "@/lib/seo/og-image";
import { getSiteUrl } from "@/lib/seo/site";
import { getActiveBanners } from "@/modules/banners/banner.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent } from "@/modules/site-content/site-content.service";

/**
 * Default share image for the home page and every page without its own image:
 * home hero banner photo + site headline (1200x630 JPEG). Text comes from
 * data/frontend/site-content.json (pages.home.hero), so it updates with Admin > Page Content.
 */
export async function GET() {
  const [settings, content, banners] = await Promise.all([
    getPublicStoreSettings(),
    getSiteContent(),
    getActiveBanners().catch(() => []),
  ]);
  const hero = banners.find((b) => b.position === "HERO");
  return ogJpegResponse({
    brand: settings.storeName,
    title: hero?.title || content.pages.home.hero.headline,
    subtitle: hero?.subtitle || content.pages.home.hero.subtitle,
    // Website address as the footer line (e.g. maisonaurelia.com).
    highlight: new URL(getSiteUrl()).host.replace(/^www\./, ""),
    photo: await loadOgPhoto(hero?.imageUrl, 600, 630),
  });
}
