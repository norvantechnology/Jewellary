import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import { EnquiryForm } from "@/components/storefront/EnquiryForm";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildBreadcrumbListJsonLd,
  buildJewelryStoreJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo/jsonld";
import { ENQUIRY_TYPE_VALUES } from "@/modules/enquiries/enquiry.schemas";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.contact.seo, { pathname: "/contact" });
}

interface ContactPageProps {
  searchParams: Promise<{ type?: string; product?: string }>;
}

async function ContactPageBody({ searchParams }: ContactPageProps) {
  const [rawSearch, settings, content] = await Promise.all([
    searchParams,
    getPublicStoreSettings(),
    getSiteContent(),
  ]);
  const page = content.pages.contact;

  const rawType = rawSearch.type?.toUpperCase();
  const defaultType = ENQUIRY_TYPE_VALUES.includes(rawType as (typeof ENQUIRY_TYPE_VALUES)[number])
    ? (rawType as (typeof ENQUIRY_TYPE_VALUES)[number])
    : "GENERAL";

  const productHint = rawSearch.product?.trim() || null;
  const contactJsonLd = buildWebPageJsonLd({
    type: "ContactPage",
    name: `${page.heading} | ${settings.storeName}`,
    description:
      "Talk to our jewelry experts about custom designs, diamonds, ring sizing or booking an appointment.",
    path: "/contact",
    settings,
  });
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Contact us", path: "/contact" },
  ]);
  const jewelryStoreJsonLd = buildJewelryStoreJsonLd(settings);

  return (
    <Section spacing="md" className="pt-8 pb-10 sm:pt-10 sm:pb-16 lg:pb-24">
      <JsonLd data={contactJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {jewelryStoreJsonLd && <JsonLd data={jewelryStoreJsonLd} />}
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.heading }]} />

        <div className="mt-4 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-6 lg:col-span-5">
            <div>
              <h1 className="type-h1 font-semibold text-foreground">{page.heading}</h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{page.intro}</p>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <Mail
                  className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {page.emailLabel}
                  </p>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold break-all text-foreground underline-offset-4 hover:text-accent-text hover:underline"
                  >
                    {settings.contactEmail}
                  </a>
                </div>
              </div>

              {settings.contactPhone && (
                <div className="flex items-start gap-3">
                  <Phone
                    className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {page.phoneLabel}
                    </p>
                    <p className="tabular-nums-price mt-0.5 text-sm font-semibold text-foreground">
                      {settings.contactPhone}
                    </p>
                  </div>
                </div>
              )}

              {settings.supportHours && (
                <div className="flex items-start gap-3">
                  <Clock
                    className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {page.hoursLabel}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{settings.supportHours}</p>
                  </div>
                </div>
              )}

              {settings.physicalStore?.streetAddress && (
                <div className="flex items-start gap-3">
                  <MapPin
                    className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {settings.physicalStore.name ?? "Our showroom"}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">
                      {[
                        settings.physicalStore.streetAddress,
                        settings.physicalStore.city,
                        settings.physicalStore.state,
                        settings.physicalStore.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {settings.physicalStore.hours && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {settings.physicalStore.hours}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-8">
              <h2 className="mb-5 text-2xl font-semibold tracking-[-0.015em] text-foreground">
                {page.formHeading}
              </h2>
              <EnquiryForm defaultType={defaultType} productName={productHint} />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default function ContactPage(props: ContactPageProps) {
  return (
    <Suspense
      fallback={
        <Section spacing="md" className="pt-8 pb-10 sm:pb-16 lg:pb-24">
          <Container>
            <Skeleton className="h-4 w-48" />
            <div className="mt-6 grid gap-8 lg:grid-cols-12">
              <Skeleton className="h-80 rounded-xl lg:col-span-5" />
              <Skeleton className="h-96 rounded-xl lg:col-span-7" />
            </div>
          </Container>
        </Section>
      }
    >
      <ContactPageBody {...props} />
    </Suspense>
  );
}
