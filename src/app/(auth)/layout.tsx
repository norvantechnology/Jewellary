import type { Metadata } from "next";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import { Container } from "@/components/shared/primitives";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
              Return to Store
            </Link>
            <ThemeSwitcher compact />
          </div>
        </Container>
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 md:py-12 lg:py-16"
      >
        {children}
      </main>
    </div>
  );
}
