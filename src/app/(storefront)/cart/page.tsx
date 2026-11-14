import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { CartPageClient } from "@/components/storefront/CartPageClient";
import { RecentlyViewedProducts } from "@/components/storefront/RecentlyViewedProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import { getServerRequestCurrency } from "@/modules/currencies/currency.service";
import { calculateCheckoutQuote } from "@/modules/orders/checkout-quote";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.cart.seo, {
    pathname: "/cart",
    canonical: "/cart",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function CartPageBody() {
  const [cart, settings, zones, resolvedCurrency, siteContent] = await Promise.all([
    getCurrentCartSummary(),
    getPublicStoreSettings(),
    getAllShippingZones(true),
    getServerRequestCurrency(),
    getSiteContent(),
  ]);
  const page = siteContent.pages.cart;

  const quoteRes =
    cart.items.length > 0
      ? calculateCheckoutQuote({
          items: cart.items,
          shippingCountry: settings.defaultCountry,
          zones,
          settings,
          targetCurrency: resolvedCurrency.currency,
        })
      : null;

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.breadcrumb }]} />

        <header className="mt-3 mb-6 border-b border-border pb-5 md:mb-8 md:pb-6">
          <h1 className="type-h1 font-semibold text-foreground">{page.heading}</h1>
        </header>

        <CartPageClient
          initialCart={cart}
          initialQuote={quoteRes?.ok ? quoteRes.quote : null}
          supportedCountries={settings.supportedCountries}
        />

        <RecentlyViewedProducts currency={settings.currency} prioritizeFirst />
      </Container>
    </Section>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <Section spacing="md" className="pt-8 pb-10 sm:pb-16 lg:pb-24">
          <Container>
            <Skeleton className="h-4 w-44" />
            <div className="mt-4 mb-8 space-y-3 border-b border-border pb-6">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-8">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
              <div className="lg:col-span-4">
                <Skeleton className="h-80 w-full rounded-xl" />
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <CartPageBody />
    </Suspense>
  );
}
