import { Suspense } from "react";
import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/shared/primitives";
import { EnquiryForm } from "@/components/storefront/EnquiryForm";
import {
  buildBreadcrumbListJsonLd,
  buildJewelryStoreJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo/jsonld";
import { INDEXABLE_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { ENQUIRY_TYPE_VALUES } from "@/modules/enquiries/enquiry.schemas";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStoreSettings();
  return buildMetadata({
    title: "Private Concierge & Bespoke Enquiries",
    description:
      "Connect with our gemology specialists for bespoke designs, diamond inspection, sizing guidance, or salon appointments.",
    pathname: "/contact",
    canonical: "/contact",
    storeName: settings.storeName,
    siteDefaultOgImage: settings.defaultOgImageUrl,
    robots: INDEXABLE_ROBOTS,
  });
}

interface ContactPageProps {
  searchParams: Promise<{ type?: string; product?: string }>;
}

async function ContactPageBody({ searchParams }: ContactPageProps) {
  const [rawSearch, settings] = await Promise.all([searchParams, getPublicStoreSettings()]);

  const rawType = rawSearch.type?.toUpperCase();
  const defaultType = ENQUIRY_TYPE_VALUES.includes(rawType as (typeof ENQUIRY_TYPE_VALUES)[number])
    ? (rawType as (typeof ENQUIRY_TYPE_VALUES)[number])
    : "GENERAL";

  const productHint = rawSearch.product?.trim() || null;
  const contactJsonLd = buildWebPageJsonLd({
    type: "ContactPage",
    name: `Private Concierge | ${settings.storeName}`,
    description:
      "Connect with our gemology specialists for bespoke designs, diamond inspection, sizing guidance, or salon appointments.",
    path: "/contact",
    settings,
  });
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: "Home", path: "/" },
    { name: "Private Concierge", path: "/contact" },
  ]);
  const jewelryStoreJsonLd = buildJewelryStoreJsonLd(settings);

  return (
    <Section spacing="sm">
      <JsonLd data={contactJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {jewelryStoreJsonLd && <JsonLd data={jewelryStoreJsonLd} />}
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Private Concierge" }]} />

        <div className="mt-4 grid gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div>
              <p className="font-sans text-editorial-label text-accent-text">Client Services</p>
              <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground">
                Private Concierge
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Whether commissioning an heirloom solitaire, arranging an in-salon viewing, or
                confirming ring size tolerances, our specialists respond personally within one
                business day.
              </p>
            </div>

            <div className="space-y-4 rounded-md border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Email
                  </p>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {settings.contactEmail}
                  </a>
                </div>
              </div>

              {settings.contactPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Telephone
                    </p>
                    <p className="text-sm font-medium text-foreground">{settings.contactPhone}</p>
                  </div>
                </div>
              )}

              {settings.supportHours && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Concierge Hours
                    </p>
                    <p className="text-sm text-foreground">{settings.supportHours}</p>
                  </div>
                </div>
              )}

              {settings.physicalStore?.streetAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {settings.physicalStore.name ?? "Maison Salon"}
                    </p>
                    <p className="text-sm text-foreground">
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
            <div className="rounded-md border border-border bg-card p-6 sm:p-8">
              <h2 className="mb-5 font-display text-2xl font-medium text-foreground">
                Send a Note to the Studio
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
        <Section spacing="sm">
          <Container>
            <div className="py-12 text-sm text-muted-foreground">Loading concierge…</div>
          </Container>
        </Section>
      }
    >
      <ContactPageBody {...props} />
    </Suspense>
  );
}
