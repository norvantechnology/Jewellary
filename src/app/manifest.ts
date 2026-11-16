import type { MetadataRoute } from "next";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicStoreSettings().catch(() => null);
  const name = settings?.storeName ?? "Shinora Jewels";

  return {
    name,
    short_name: name,
    description:
      settings?.tagline ??
      "Moissanite and lab-grown diamond jewelry, handmade to order in 925 sterling silver, 9K–18K solid gold and platinum.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_PALETTE.light.bg,
    theme_color: BRAND_PALETTE.light.bg,
    icons: [
      {
        src: "/icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icon-96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
