import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { CheckoutClient } from "@/components/storefront/CheckoutClient";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import {
  getCheckoutBootstrapData,
  getOrderConfirmation,
  type OrderConfirmationDTO,
} from "@/modules/orders/order.service";
import { isCancellableBeforeSettlement } from "@/modules/orders/state-machine";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.checkout.seo, {
    pathname: "/checkout",
    canonical: "/checkout",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function CheckoutBody({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const [params, bootstrap, content] = await Promise.all([
    searchParams,
    getCheckoutBootstrapData(),
    getSiteContent(),
  ]);

  let initialRetryOrder: {
    order: OrderConfirmationDTO;
    guestToken: string | null;
  } | null = null;

  if (params.order) {
    try {
      const candidate = await getOrderConfirmation(params.order, params.token ?? null);
      if (isCancellableBeforeSettlement(candidate.status)) {
        initialRetryOrder = {
          order: candidate,
          guestToken: params.token ?? null,
        };
      }
    } catch {
      initialRetryOrder = null;
    }
  }

  return (
    <Section
      spacing="md"
      data-focus-layout=""
      className="pt-4 pb-28 sm:pt-6 md:pt-6 lg:pt-8 lg:pb-24"
    >
      <Container>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: content.pages.checkout.breadcrumbCart, href: "/cart" },
            { label: content.pages.checkout.breadcrumb },
          ]}
        />

        <header className="mt-2 mb-4 md:mt-2 md:mb-6 md:border-b md:border-border md:pb-4">
          <h1 className="type-h1 font-semibold text-foreground">
            {initialRetryOrder
              ? content.pages.checkout.retryHeading
              : content.pages.checkout.heading}
          </h1>
        </header>

        <CheckoutClient bootstrap={bootstrap} initialRetryOrder={initialRetryOrder} />
      </Container>
    </Section>
  );
}

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <Section spacing="md" className="pt-8 pb-20 lg:pb-24">
          <Container>
            <Skeleton className="h-4 w-44" />
            <div className="mt-4 mb-8 space-y-3 border-b border-border pb-6">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-10 w-64" />
            </div>
            <Skeleton className="mb-6 h-16 w-full rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-80 w-full rounded-xl" />
              </div>
              <div className="lg:col-span-5">
                <Skeleton className="h-96 w-full rounded-xl" />
              </div>
            </div>
          </Container>
        </Section>
      }
    >
      <CheckoutBody searchParams={searchParams} />
    </Suspense>
  );
}
