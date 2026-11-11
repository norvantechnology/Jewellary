import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import { Container } from "@/components/shared/primitives";
import type { SiteHeaderConfig } from "@/types/navigation";

interface HeaderProps {
  config: SiteHeaderConfig;
  searchSlot?: React.ReactNode;
  cartTriggerSlot?: React.ReactNode;
  wishlistCountSlot?: React.ReactNode;
  accountLinkSlot?: React.ReactNode;
}

export function Header({
  config,
  searchSlot,
  cartTriggerSlot,
  wishlistCountSlot,
  accountLinkSlot,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <AnnouncementBar
        enabled={config.announcementEnabled}
        text={config.announcementText}
        href={config.announcementHref}
      />

      <Container>
        <div className="flex h-16 items-center justify-between gap-2 md:h-20 md:gap-3">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <MobileNav siteName={config.siteName} categories={config.categories} />
            <Link href="/" aria-label={`${config.siteName} homepage`} className="min-w-0">
              <Logo siteName={config.siteName} />
            </Link>
          </div>

          <MegaMenu categories={config.categories} />

          <div className="flex shrink-0 items-center gap-1">
            {searchSlot ?? (
              <Link
                href="/search"
                aria-label="Search collection"
                className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
              >
                <Search className="size-4.5" aria-hidden="true" />
              </Link>
            )}

            <div className="hidden sm:block">
              <ThemeSwitcher compact />
            </div>

            <span className="hidden sm:inline-flex">
              {wishlistCountSlot ?? (
                <Link
                  href="/wishlist"
                  aria-label="Wishlist"
                  className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Heart className="size-4.5" aria-hidden="true" />
                </Link>
              )}
            </span>

            <span className="hidden sm:inline-flex">
              {accountLinkSlot ?? (
                <Link
                  href="/account"
                  aria-label="My account"
                  className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
                >
                  <User className="size-4.5" aria-hidden="true" />
                </Link>
              )}
            </span>

            {cartTriggerSlot ?? (
              <Link
                href="/cart"
                aria-label="Shopping bag"
                className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
              >
                <ShoppingBag className="size-4.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
