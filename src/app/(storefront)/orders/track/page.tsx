import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { GuestOrderTrackClient } from "@/components/storefront/GuestOrderTrackClient";
import { NOINDEX_NOFOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Track an Order",
  description:
    "Verify your order number and checkout email to inspect status and insured tracking.",
  pathname: "/orders/track",
  canonical: "/orders/track",
  robots: NOINDEX_NOFOLLOW_ROBOTS,
});

async function TrackBody({ searchParams }: { searchParams: Promise<{ orderNumber?: string }> }) {
  const { orderNumber } = await searchParams;
  return <GuestOrderTrackClient initialOrderNumber={orderNumber} />;
}

export default function GuestOrderTrackPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string }>;
}) {
  return (
    <Section spacing="sm">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track Order" }]} />

        <div className="mx-auto mb-8 max-w-xl text-center">
          <p className="font-sans text-editorial-label text-accent-text">Insured Dispatch Lookup</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Track Your Commission
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Enter your order number and purchasing email address to review atelier progress, courier
            tracking, and printable receipts.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="mx-auto max-w-xl rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Preparing lookup form…
            </div>
          }
        >
          <TrackBody searchParams={searchParams} />
        </Suspense>
      </Container>
    </Section>
  );
}
