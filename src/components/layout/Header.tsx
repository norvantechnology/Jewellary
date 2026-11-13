import * as React from "react";
import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { HeaderScrollShell } from "@/components/layout/HeaderScrollShell";
import { MegaMenu, MegaMenuFallback } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import type { SiteHeaderConfig } from "@/types/navigation";

interface HeaderProps {
  config: SiteHeaderConfig;
  searchSlot?: React.ReactNode;
  wishlistCountSlot?: React.ReactNode;
  cartTriggerSlot?: React.ReactNode;
  accountLinkSlot?: React.ReactNode;
}

export function Header({
  config,
  searchSlot,
  wishlistCountSlot,
  cartTriggerSlot,
  accountLinkSlot,
}: HeaderProps) {
  return (
    <HeaderScrollShell>
      <AnnouncementBar
        enabled={config.announcementEnabled}
        text={config.announcementText}
        href={config.announcementHref}
        freeShippingThreshold={config.freeShippingThreshold}
        baseCurrency={config.baseCurrency}
      />

      <div className="ma-header-inner container-wide grid h-14 grid-cols-[minmax(44px,1fr)_minmax(0,auto)_minmax(96px,1fr)] items-center gap-2 md:flex md:h-16 md:items-center md:justify-between md:gap-4 lg:h-[72px]">
        {/* Mobile menu trigger */}
        <div className="flex items-center justify-self-start lg:hidden">
          <MobileNav siteName={config.siteName} categories={config.categories} />
        </div>

        {/* Brand wordmark */}
        <div className="flex min-w-0 items-center justify-self-center md:justify-self-auto">
          <Logo siteName={config.siteName} />
        </div>

        {/* Desktop primary navigation */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center">
          <React.Suspense fallback={<MegaMenuFallback />}>
            <MegaMenu categories={config.categories} />
          </React.Suspense>
        </div>

        {/* Utility icon actions: mobile shows search + bag; md+ shows full utility bar */}
        <div className="flex items-center justify-end gap-2 justify-self-end md:justify-self-auto">
          {searchSlot ?? (
            <Link
              href="/search"
              aria-label="Search"
              className="transition-ui inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Search className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}

          <CurrencySwitcher compact className="hidden md:inline-flex" />

          <ThemeSwitcher className="hidden md:inline-flex" showTooltip />

          {wishlistCountSlot ?? (
            <Link
              href="/wishlist"
              aria-label="Wishlist (0 saved items)"
              className="transition-ui hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
            >
              <Heart className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}

          {accountLinkSlot ?? (
            <Link
              href="/account"
              aria-label="Account"
              className="transition-ui hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
            >
              <User className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}

          {cartTriggerSlot ?? (
            <Link
              href="/cart"
              aria-label="Shopping bag (0 items)"
              className="transition-ui inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ShoppingBag className="size-6" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </HeaderScrollShell>
  );
}
