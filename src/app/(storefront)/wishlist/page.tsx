import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { WishlistPageClient } from "@/components/storefront/WishlistPageClient";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getCurrentWishlistState } from "@/modules/wishlist/wishlist.service";

export const metadata: Metadata = buildMetadata({
  title: "Saved Pieces & Wishlist",
  description:
    "Review your saved jewellery pieces and move selections directly to your shopping bag.",
  pathname: "/wishlist",
  canonical: "/wishlist",
  robots: NOINDEX_FOLLOW_ROBOTS,
});

async function WishlistBody() {
  const [wishlist, settings] = await Promise.all([
    getCurrentWishlistState(),
    getPublicStoreSettings(),
  ]);

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />

        <header className="mt-3 mb-6 border-b border-border pb-6 sm:mb-8">
          <h1 className="type-h1 font-display font-semibold text-foreground">Your Wishlist</h1>
          <p className="prose-limit mt-3 text-base leading-relaxed text-muted-foreground">
            Saved creations persist automatically across your session and merge into your account
            when you sign in.
          </p>
        </header>

        <WishlistPageClient
          key={wishlist.variantIds.join(",")}
          initialItems={wishlist.items}
          currency={settings.currency}
        />
      </Container>
    </Section>
  );
}

export default function WishlistPage() {
  return (
    <Suspense
      fallback={
        <Section spacing="md" className="pt-8 pb-10 sm:pb-16 lg:pb-24">
          <Container>
            <Skeleton className="h-4 w-44" />
            <div className="mt-4 mb-8 space-y-3 border-b border-border pb-6">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-10 w-56" />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
              <Skeleton className="aspect-[4/5] w-full rounded-lg" />
              <Skeleton className="aspect-[4/5] w-full rounded-lg" />
              <Skeleton className="hidden aspect-[4/5] w-full rounded-lg lg:block" />
            </div>
          </Container>
        </Section>
      }
    >
      <WishlistBody />
    </Suspense>
  );
}
