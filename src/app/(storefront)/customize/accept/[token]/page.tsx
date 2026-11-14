import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata } from "@/modules/site-content/site-content.service";
import { QuoteAcceptClient } from "@/components/storefront/QuoteAcceptClient";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveQuoteAcceptanceToken } from "@/modules/customization/customization.service";
import { resolveActorIdentity } from "@/server/customer-identity";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.quote.seo, {
    pathname: "/customize/accept",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function AcceptQuoteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await resolveActorIdentity({ createGuestCookie: false });
  const resolution = await resolveQuoteAcceptanceToken(token, actor).catch(() => ({
    state: "INVALID" as const,
  }));

  return <QuoteAcceptClient token={token} resolution={resolution} />;
}

export default function AcceptQuotePage(props: { params: Promise<{ token: string }> }) {
  return (
    <div className="container mx-auto px-4 py-10 sm:py-16">
      <Suspense
        fallback={
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        }
      >
        <AcceptQuoteContent params={props.params} />
      </Suspense>
    </div>
  );
}
