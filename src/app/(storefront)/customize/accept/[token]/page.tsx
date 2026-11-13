import { Suspense } from "react";
import type { Metadata } from "next";
import { QuoteAcceptClient } from "@/components/storefront/QuoteAcceptClient";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveQuoteAcceptanceToken } from "@/modules/customization/customization.service";
import { resolveActorIdentity } from "@/server/customer-identity";

export const metadata: Metadata = {
  title: "Review Bespoke Quotation",
  robots: { index: false, follow: false },
};

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
