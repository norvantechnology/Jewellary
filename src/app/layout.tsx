import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DeferredOverlays } from "@/components/layout/DeferredOverlays";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { UiTextProvider } from "@/components/providers/UiTextProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { INDEXABLE_ROBOTS, SITE_LOCALE, getSiteUrl } from "@/lib/seo/metadata";
import { DEFAULT_BRAND_NAME } from "@/lib/seo/site";
import { getSiteContent } from "@/modules/site-content/site-content.service";
import "./globals.css";

// Display / headings: Cormorant Garamond. Body / UI: Jost.
// Self-hosted variable woff2 (latin) so builds never depend on reaching Google Fonts.
const fontDisplay = localFont({
  src: [
    { path: "../fonts/cormorant-garamond-latin.woff2", weight: "300 700", style: "normal" },
    { path: "../fonts/cormorant-garamond-italic-latin.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-heading",
  display: "swap",
  preload: true,
  fallback: ["Garamond", "Georgia", "Times New Roman", "serif"],
});

const fontSans = localFont({
  src: [{ path: "../fonts/jost-latin.woff2", weight: "300 700", style: "normal" }],
  variable: "--font-body",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});

const siteUrl = getSiteUrl();
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? DEFAULT_BRAND_NAME;

function getImageCdnOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_IMAGE_CDN_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const imageCdnOrigin = getImageCdnOrigin();

// Default title, title template and description: data/frontend/site-content.json → site.seo
export async function generateMetadata(): Promise<Metadata> {
  const { seo } = (await getSiteContent()).site;
  return {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.description,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
        { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName,
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: INDEXABLE_ROBOTS,
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION
        ? { google: process.env.GOOGLE_SITE_VERIFICATION }
        : {}),
      ...(process.env.BING_SITE_VERIFICATION || process.env.PINTEREST_SITE_VERIFICATION
        ? {
            other: {
              ...(process.env.BING_SITE_VERIFICATION
                ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
                : {}),
              ...(process.env.PINTEREST_SITE_VERIFICATION
                ? { "p:domain_verify": process.env.PINTEREST_SITE_VERIFICATION }
                : {}),
            },
          }
        : {}),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_PALETTE.light.bg },
    { media: "(prefers-color-scheme: dark)", color: BRAND_PALETTE.dark.bg },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { ui } = await getSiteContent();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable}`}
    >
      <body className="min-h-dvh bg-bg font-sans text-base text-text-2 antialiased">
        <Suspense fallback={null}>
          <ScrollToTop />
          <NavigationProgress />
        </Suspense>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-md"
        >
          {ui.common.skipToContent}
        </a>
        <ThemeProvider imageCdnOrigin={imageCdnOrigin}>
          <MotionProvider>
            <UiTextProvider value={ui}>
              {children}
              <DeferredOverlays gaId={process.env.NEXT_PUBLIC_GA_ID} />
            </UiTextProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
