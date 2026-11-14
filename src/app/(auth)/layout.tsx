import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import { Container } from "@/components/shared/primitives";
import { env } from "@/lib/env";
import { getActiveBanners } from "@/modules/banners/banner.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getSiteContent } from "@/modules/site-content/site-content.service";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Header link label shared by all sign-in pages: site-content.json → pages.auth.login.returnToStore
  const [content, banners, settings] = await Promise.all([
    getSiteContent(),
    getActiveBanners().catch(() => []),
    getPublicStoreSettings(),
  ]);
  const { returnToStore } = content.pages.auth.login;
  // Brand photo beside the form on large screens: the hero banner set in Admin > Banners.
  const hero = banners.find((b) => b.position === "HERO") ?? banners[0] ?? null;
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="safe-area-pt border-b border-border bg-background/95 backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-2 md:h-16 md:gap-4">
          <Logo siteName={env.NEXT_PUBLIC_SITE_NAME} />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/collections"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground/45 sm:px-3"
            >
              {returnToStore}
            </Link>
            <ThemeSwitcher compact />
          </div>
        </Container>
      </header>

      <div className="flex flex-1">
        {hero ? (
          <aside className="relative hidden w-[44%] max-w-[720px] overflow-hidden bg-surface-2 lg:block">
            <Image
              src={hero.imageUrl}
              alt={hero.altText}
              fill
              priority
              sizes="44vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
              <p className="font-display text-3xl leading-tight font-medium xl:text-4xl">
                {settings.storeName}
              </p>
              {settings.tagline ? (
                <p className="mt-3 max-w-md text-base text-white/85">{settings.tagline}</p>
              ) : null}
            </div>
          </aside>
        ) : null}
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 md:py-12 lg:py-16"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
