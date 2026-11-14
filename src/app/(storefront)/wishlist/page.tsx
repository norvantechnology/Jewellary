import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { WishlistPageClient } from "@/components/storefront/WishlistPageClient";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_FOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getCurrentWishlistState } from "@/modules/wishlist/wishlist.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.wishlist.seo, {
    pathname: "/wishlist",
    canonical: "/wishlist",
    robots: NOINDEX_FOLLOW_ROBOTS,
  });
}

async function WishlistBody() {
  const [wishlist, settings, content] = await Promise.all([
    getCurrentWishlistState(),
    getPublicStoreSettings(),
    getSiteContent(),
  ]);
  const page = content.pages.wishlist;

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.breadcrumb }]} />

        <header className="mt-3 mb-6 border-b border-border pb-6 sm:mb-8">
          <h1 className="type-h1 font-display font-semibold text-foreground">{page.heading}</h1>
          <p className="prose-limit mt-3 text-base leading-relaxed text-muted-foreground">
            {page.intro}
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
