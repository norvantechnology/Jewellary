import { Suspense } from "react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container, Section } from "@/components/shared/primitives";
import { CheckoutClient } from "@/components/storefront/CheckoutClient";
import { NOINDEX_NOFOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import {
  getCheckoutBootstrapData,
  getOrderConfirmation,
  type OrderConfirmationDTO,
} from "@/modules/orders/order.service";
import { isCancellableBeforeSettlement } from "@/modules/orders/state-machine";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Complete your insured jewellery commission cleanly and securely.",
  pathname: "/checkout",
  canonical: "/checkout",
  robots: NOINDEX_NOFOLLOW_ROBOTS,
});

async function CheckoutBody({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const [params, bootstrap] = await Promise.all([searchParams, getCheckoutBootstrapData()]);

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
    <Section spacing="sm">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Bag", href: "/cart" },
            { label: "Checkout" },
          ]}
        />

        <header className="mt-2 mb-8 border-b border-border pb-6">
          <p className="font-sans text-editorial-label text-accent-text">
            Insured Vault Reservation
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground">
            {initialRetryOrder ? "Complete Payment Authorization" : "Secure Checkout"}
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
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Preparing insured checkout…</div>
          </Container>
        </Section>
      }
    >
      <CheckoutBody searchParams={searchParams} />
    </Suspense>
  );
}
