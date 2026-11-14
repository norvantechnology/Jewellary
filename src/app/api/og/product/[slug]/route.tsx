import { formatMoney } from "@/lib/money";
import { loadOgPhoto, ogJpegResponse } from "@/lib/seo/og-image";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent } from "@/modules/site-content/site-content.service";

/** Share image for /products/[slug]: product photo + name + price (1200x630 JPEG). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await getPublicProductBySlug(slug).catch(() => null);
  if (!resolved || resolved.kind !== "product") {
    const content = await getSiteContent();
    return ogJpegResponse({ brand: settings.storeName, title: content.site.seo.defaultTitle });
  }
  const { product } = resolved;
  const content = await getSiteContent();
  const photoSrc = product.images.find((img) => img.url && !img.url.endsWith(".svg"))?.url ?? null;
  return ogJpegResponse({
    brand: settings.storeName,
    eyebrow: product.categoryName,
    title: product.name,
    subtitle: product.subtitle,
    highlight:
      product.priceMode === "PRICE_ON_REQUEST"
        ? content.ui.common.priceOnRequest
        : formatMoney(Number(product.basePrice), settings.currency),
    photo: await loadOgPhoto(photoSrc, 600, 630),
  });
}
