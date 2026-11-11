import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { WishlistPageClient } from "@/components/storefront/WishlistPageClient";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getCurrentWishlistState } from "@/modules/wishlist/wishlist.service";

export const metadata: Metadata = {
  title: "Saved Pieces & Wishlist",
  description:
    "Review your saved jewellery pieces and move selections directly to your shopping bag.",
  robots: { index: false, follow: true },
};

async function WishlistBody() {
  const [wishlist, settings] = await Promise.all([
    getCurrentWishlistState(),
    getPublicStoreSettings(),
  ]);

  return (
    <Section spacing="sm">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />

        <header className="mt-2 mb-8 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">Saved Selections</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground">
            Your Wishlist
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved creations persist automatically across your session and merge into your account
            when you sign in.
          </p>
        </header>

        <WishlistPageClient initialItems={wishlist.items} currency={settings.currency} />
      </Container>
    </Section>
  );
}

export default function WishlistPage() {
  return (
    <Suspense
      fallback={
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Loading your saved pieces…</div>
          </Container>
        </Section>
      }
    >
      <WishlistBody />
    </Suspense>
  );
}
