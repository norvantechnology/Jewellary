import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  const siteName = env.NEXT_PUBLIC_SITE_NAME;
  return {
    name: `${siteName} — Fine Jewellery & Certified Diamonds`,
    short_name: siteName,
    description:
      "Handcrafted 18K gold and platinum fine jewellery featuring GIA and IGI certified diamonds.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#9A7532",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
