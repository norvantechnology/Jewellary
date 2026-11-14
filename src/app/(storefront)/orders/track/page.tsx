import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { GuestOrderTrackClient } from "@/components/storefront/GuestOrderTrackClient";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.track.seo, {
    pathname: "/orders/track",
    canonical: "/orders/track",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function TrackBody({ searchParams }: { searchParams: Promise<{ orderNumber?: string }> }) {
  const { orderNumber } = await searchParams;
  return <GuestOrderTrackClient initialOrderNumber={orderNumber} />;
}

export default async function GuestOrderTrackPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string }>;
}) {
  const page = (await getSiteContent()).pages.track;
  return (
    <Section spacing="md" className="pt-4 pb-10 sm:pt-6 sm:pb-16 md:pt-6 lg:pt-8 lg:pb-24">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.breadcrumb }]} />

        <div className="mx-auto mt-3 mb-6 max-w-xl text-center sm:mb-8">
          <h1 className="type-h1 font-semibold text-foreground">{page.heading}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
            {page.intro}
          </p>
        </div>

        <Suspense
          fallback={
            <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-4 sm:p-8">
              <div className="space-y-4">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-44" />
              </div>
            </div>
          }
        >
          <TrackBody searchParams={searchParams} />
        </Suspense>
      </Container>
    </Section>
  );
}
