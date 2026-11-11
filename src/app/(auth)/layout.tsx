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
      <header className="border-b border-border bg-card/70">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${env.NEXT_PUBLIC_SITE_NAME} homepage`}>
            <Logo siteName={env.NEXT_PUBLIC_SITE_NAME} />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/collections"
              className="text-xs font-medium tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              Return to Store
            </Link>
            <ThemeSwitcher compact />
          </div>
        </Container>
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:py-16"
      >
        {children}
      </main>
    </div>
  );
}
