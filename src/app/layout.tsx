import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { ConsentAnalytics } from "@/components/layout/ConsentAnalytics";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { INDEXABLE_ROBOTS, SITE_LOCALE, getSiteUrl } from "@/lib/seo/metadata";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jost",
  display: "swap",
});

const siteUrl = getSiteUrl();
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Maison Aurelia";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — Fine Diamonds & Heirloom Jewellery`,
    template: `%s | ${siteName}`,
  },
  description:
    "Discover GIA-certified diamonds, bespoke engagement rings, and 18K fine jewellery crafted with transparent provenance and insured delivery.",
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
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#15110E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${cormorant.variable} ${jost.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          {children}
          <Suspense fallback={null}>
            <CookieBanner />
          </Suspense>
          <Toaster />
          <ConsentAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        </ThemeProvider>
      </body>
    </html>
  );
}
