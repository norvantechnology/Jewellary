import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { CartPageClient } from "@/components/storefront/CartPageClient";
import { NOINDEX_NOFOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import { calculateCheckoutQuote } from "@/modules/orders/checkout-quote";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = buildMetadata({
  title: "Shopping Bag",
  description: "Review the jewellery creations in your shopping bag.",
  pathname: "/cart",
  canonical: "/cart",
  robots: NOINDEX_NOFOLLOW_ROBOTS,
});

async function CartPageBody() {
  const [cart, settings, zones] = await Promise.all([
    getCurrentCartSummary(),
    getPublicStoreSettings(),
    getAllShippingZones(true),
  ]);

  const quoteRes =
    cart.items.length > 0
      ? calculateCheckoutQuote({
          items: cart.items,
          shippingCountry: settings.defaultCountry,
          zones,
          settings,
        })
      : null;

  return (
    <Section spacing="sm">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shopping Bag" }]} />

        <header className="mt-2 mb-8 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">Insured Studio Order</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground">
            Your Shopping Bag
          </h1>
        </header>

        <CartPageClient
          initialCart={cart}
          initialQuote={quoteRes?.ok ? quoteRes.quote : null}
          supportedCountries={settings.supportedCountries}
        />
      </Container>
    </Section>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Loading your shopping bag…</div>
          </Container>
        </Section>
      }
    >
      <CartPageBody />
    </Suspense>
  );
}
