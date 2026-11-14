import { getSiteContent } from "@/modules/site-content/site-content.service";
import { Suspense } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { BackToTop, ScrollProgressBar } from "@/components/motion/BackToTop";
import { PageTransition } from "@/components/motion/PageTransition";
import { CurrencyHydrator, CurrencyProvider } from "@/components/providers/CurrencyProvider";
import { HeaderSearchBar } from "@/components/storefront/HeaderSearchBar";
import {
  HeaderAccountAction,
  HeaderCartAction,
  HeaderWishlistAction,
} from "@/components/storefront/StorefrontHeaderActions";
import { StorefrontFeatureOverlays } from "@/components/storefront/StorefrontFeatureOverlays";
import { VisitorStateHydrator } from "@/components/storefront/VisitorStateHydrator";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import {
  getCurrencyCatalogContext,
  getServerRequestCurrency,
} from "@/modules/currencies/currency.service";
import { getSiteHeaderConfig } from "@/modules/settings/settings.service";
import { getCurrentWishlistState } from "@/modules/wishlist/wishlist.service";
import { getOptionalSession } from "@/server/dal";

async function AsyncWishlistHeaderSlot() {
  const [wishlist, cart] = await Promise.all([getCurrentWishlistState(), getCurrentCartSummary()]);
  return (
    <>
      <VisitorStateHydrator wishlistVariantIds={wishlist.variantIds} bagCount={cart.itemCount} />
      <HeaderWishlistAction initialCount={wishlist.count} />
    </>
  );
}

async function AsyncCartHeaderSlot() {
  const cart = await getCurrentCartSummary();
  return <HeaderCartAction initialCount={cart.itemCount} />;
}

async function AsyncAccountHeaderSlot() {
  const session = await getOptionalSession();
  const user = session?.user;
  const href = !user
    ? "/login"
    : user.role === "ADMIN" || user.role === "STAFF"
      ? "/admin"
      : "/account";
  const label = !user
    ? "Sign in"
    : user.role === "ADMIN" || user.role === "STAFF"
      ? "Admin Studio"
      : `Account (${user.name})`;

  return <HeaderAccountAction href={href} label={label} />;
}

async function AsyncCurrencySlot() {
  const resolved = await getServerRequestCurrency();
  return (
    <CurrencyHydrator detectedCode={resolved.currency.code} detectionSource={resolved.source} />
  );
}

export async function StorefrontShell({ children }: { children: React.ReactNode }) {
  const [headerConfig, currencyCatalog, siteContent] = await Promise.all([
    getSiteHeaderConfig(),
    getCurrencyCatalogContext(),
    getSiteContent(),
  ]);

  return (
    <CurrencyProvider
      currencies={currencyCatalog.currencies}
      defaultCurrencyCode={currencyCatalog.defaultCurrency.code}
      baseCurrencyCode={currencyCatalog.baseCurrency.code}
    >
      <Suspense fallback={null}>
        <AsyncCurrencySlot />
      </Suspense>

      <div className="flex min-h-dvh flex-col bg-background">
        <Header
          config={headerConfig}
          navLabels={siteContent.site.header}
          searchSlot={<HeaderSearchBar />}
          wishlistCountSlot={
            <Suspense fallback={<HeaderWishlistAction initialCount={0} />}>
              <AsyncWishlistHeaderSlot />
            </Suspense>
          }
          cartTriggerSlot={
            <Suspense fallback={<HeaderCartAction initialCount={0} />}>
              <AsyncCartHeaderSlot />
            </Suspense>
          }
          accountLinkSlot={
            <Suspense
              fallback={
                <Link
                  href="/login"
                  aria-label={siteContent.ui.layout.account}
                  className="transition-ui hidden size-11 items-center justify-center rounded-md text-foreground hover:bg-muted sm:inline-flex lg:size-10"
                >
                  <User className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              }
            >
              <AsyncAccountHeaderSlot />
            </Suspense>
          }
        />

        <ScrollProgressBar />

        <main id="main-content" className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>

        <Footer config={headerConfig} content={siteContent.site.footer} />
        <BackToTop />
        <StorefrontFeatureOverlays />
      </div>
    </CurrencyProvider>
  );
}
