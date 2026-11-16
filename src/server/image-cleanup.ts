import "server-only";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import {
  deleteImageAssets,
  isDeletableStorageKey,
  storageKeyFromPublicUrl,
} from "@/server/storage";

/** An image to remove: a full asset row, or just a public URL (category/banner style fields). */
export type DisposableImage =
  | string
  | {
      storageKey?: string | null;
      url: string;
      mediumUrl?: string | null;
      thumbUrl?: string | null;
    };

/** "public/products/abc" for S3 keys, "/uploads/products/abc" for local files. */
function stemOf(image: DisposableImage): string | null {
  const url = typeof image === "string" ? image : image.url;
  const key = (typeof image === "string" ? null : image.storageKey) ?? storageKeyFromPublicUrl(url);
  if (key && isDeletableStorageKey(key)) return key.replace(/\.webp$/i, "");
  if (url?.startsWith("/uploads/"))
    return url.replace(/(-med|-thumb)?\.(webp|avif|jpe?g|png)$/i, "");
  return null;
}

/**
 * True when any record still points at a file with this stem: product galleries, past orders,
 * customization requests, chat, categories, shape pages, banners, articles and store settings.
 */
async function isStemReferenced(stem: string): Promise<boolean> {
  // The "." / "-" after the stem stops "ring-1" from matching "ring-10".
  const like = (field: string) => [
    { [field]: { contains: `${stem}.` } },
    { [field]: { contains: `${stem}-med.` } },
    { [field]: { contains: `${stem}-thumb.` } },
  ];
  const counts = await Promise.all([
    db.productImage.count({ where: { OR: [...like("url"), ...like("storageKey")] } }),
    db.product.count({ where: { OR: like("ogImageUrl") } }),
    db.orderItem.count({ where: { OR: like("imageUrlSnapshot") } }),
    db.customizationRequestImage.count({ where: { OR: like("thumbUrl") } }),
    db.chatAttachment.count({ where: { OR: like("thumbUrl") } }),
    db.category.count({ where: { OR: [...like("imageUrl"), ...like("ogImageUrl")] } }),
    db.landingFacet.count({ where: { OR: [...like("imageUrl"), ...like("ogImageUrl")] } }),
    db.banner.count({ where: { OR: [...like("imageUrl"), ...like("mobileImageUrl")] } }),
    db.article.count({ where: { OR: [...like("coverImageUrl"), ...like("ogImageUrl")] } }),
    db.storeSetting.count({ where: { OR: [...like("logoUrl"), ...like("defaultOgImageUrl")] } }),
    db.staticPageSeo.count({ where: { OR: like("ogImageUrl") } }),
    db.customizationOptionValue.count({ where: { OR: like("swatchImageUrl") } }),
  ]);
  return counts.some((n) => n > 0);
}

/**
 * Deletes replaced/removed images from the bucket once nothing uses them any more.
 * Call after the database change is saved. Never throws: a failed cleanup must not fail a save.
 */
export async function deleteImagesIfUnused(images: DisposableImage[]): Promise<number> {
  const seen = new Set<string>();
  const toDelete: Array<{
    storageKey: string | null;
    url: string;
    mediumUrl: string | null;
    thumbUrl: string | null;
  }> = [];
  try {
    for (const image of images) {
      if (!image) continue;
      const stem = stemOf(image);
      if (!stem || seen.has(stem)) continue;
      seen.add(stem);
      if (await isStemReferenced(stem)) continue;
      toDelete.push(
        stem.startsWith("/uploads/")
          ? {
              storageKey: null,
              url: `${stem}.webp`,
              mediumUrl: `${stem}-med.webp`,
              thumbUrl: `${stem}-thumb.webp`,
            }
          : { storageKey: `${stem}.webp`, url: "", mediumUrl: null, thumbUrl: null },
      );
    }
    await deleteImageAssets(toDelete);
    return toDelete.length;
  } catch (err) {
    logger.warn({ err }, "Image cleanup failed");
    return 0;
  }
}

/** Old-vs-new helper: images in `before` that are not in `after`. */
export function droppedImages<T extends DisposableImage>(
  before: T[],
  after: DisposableImage[],
): T[] {
  const keep = new Set(after.map((i) => stemOf(i)).filter(Boolean));
  return before.filter((i) => {
    const stem = stemOf(i);
    return stem !== null && !keep.has(stem);
  });
}
