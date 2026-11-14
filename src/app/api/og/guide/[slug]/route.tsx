import { loadOgPhoto, ogJpegResponse } from "@/lib/seo/og-image";
import { resolvePublishedArticleBySlug } from "@/modules/articles/article.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent } from "@/modules/site-content/site-content.service";

/** Share image for /guides/[slug]: cover photo + guide title + excerpt (1200x630 JPEG). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, settings, content] = await Promise.all([
    params,
    getPublicStoreSettings(),
    getSiteContent(),
  ]);
  const resolved = await resolvePublishedArticleBySlug(slug).catch(() => null);
  if (!resolved || resolved.kind !== "article") {
    return ogJpegResponse({ brand: settings.storeName, title: content.pages.guides.heading });
  }
  const { article } = resolved;
  return ogJpegResponse({
    brand: settings.storeName,
    eyebrow: content.pages.guides.heading,
    title: article.title,
    subtitle: article.excerpt,
    highlight: article.authorName,
    photo: await loadOgPhoto(article.coverImageUrl, 600, 630),
  });
}
