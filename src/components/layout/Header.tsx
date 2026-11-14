import * as React from "react";
import { UiText } from "@/components/shared/UiText";
import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { HeaderScrollShell } from "@/components/layout/HeaderScrollShell";
import { MegaMenu, MegaMenuFallback } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import type { NavLabels } from "@/components/layout/navigation-data";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import type { SiteHeaderConfig } from "@/types/navigation";

interface HeaderProps {
  config: SiteHeaderConfig;
  /** Menu labels from site-content.json → site.header. */
  navLabels: NavLabels;
  searchSlot?: React.ReactNode;
  wishlistCountSlot?: React.ReactNode;
  cartTriggerSlot?: React.ReactNode;
  accountLinkSlot?: React.ReactNode;
}

export function Header({
  config,
  navLabels,
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
          <MobileNav siteName={config.siteName} categories={config.categories} labels={navLabels} />
        </div>

        {/* Brand wordmark */}
        <div className="flex min-w-0 items-center justify-self-center md:justify-self-auto">
          <Logo siteName={config.siteName} />
        </div>

        {/* Desktop primary navigation */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center">
          <React.Suspense fallback={<MegaMenuFallback labels={navLabels} />}>
            <MegaMenu categories={config.categories} labels={navLabels} />
          </React.Suspense>
        </div>

        {/* Utility icon actions: mobile shows search + bag; md+ shows full utility bar */}
        <div className="flex items-center justify-end gap-2 justify-self-end md:justify-self-auto">
          {searchSlot ?? (
            <Link
              href="/search"
              className="transition-ui inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Search className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">
                <UiText section="layout" name="search" />
              </span>
            </Link>
          )}

          <CurrencySwitcher compact className="hidden md:inline-flex" />

          <ThemeSwitcher className="hidden md:inline-flex" showTooltip />

          {wishlistCountSlot ?? (
            <Link
              href="/wishlist"
              className="transition-ui hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
            >
              <Heart className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">
                <UiText section="layout" name="wishlistEmpty" />
              </span>
            </Link>
          )}

          {accountLinkSlot ?? (
            <Link
              href="/account"
              className="transition-ui hidden size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
            >
              <User className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">
                <UiText section="layout" name="account" />
              </span>
            </Link>
          )}

          {cartTriggerSlot ?? (
            <Link
              href="/cart"
              className="transition-ui inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ShoppingBag className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">
                <UiText section="layout" name="bagEmpty" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </HeaderScrollShell>
  );
}
