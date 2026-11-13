import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CustomizationFormClient } from "@/components/storefront/CustomizationFormClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NOINDEX_FOLLOW_ROBOTS, buildMetadata } from "@/lib/seo/metadata";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getProductCustomizationSchema } from "@/modules/customization/customization.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

interface CustomizeProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CustomizeProductPageProps): Promise<Metadata> {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await getPublicProductBySlug(slug).catch(() => null);
  if (!resolved || resolved.kind !== "product" || !resolved.product.isCustomizable) {
    return buildMetadata({
      title: "Bespoke Customization",
      description: "Design a personalized Maison Aurelia piece with our master jewellers.",
      pathname: `/products/${slug}/customize`,
      storeName: settings.storeName,
      robots: NOINDEX_FOLLOW_ROBOTS,
    });
  }

  return buildMetadata({
    title: `Customize ${resolved.product.name}`,
    description: `Configure bespoke metals, gemstones, sizing, and engraving for ${resolved.product.name}.`,
    pathname: `/products/${resolved.product.slug}/customize`,
    canonical: `/products/${resolved.product.slug}`,
    storeName: settings.storeName,
    robots: NOINDEX_FOLLOW_ROBOTS,
  });
}

async function CustomizeProductContent({ params }: CustomizeProductPageProps) {
  const { slug } = await params;
  const schema = await getProductCustomizationSchema(slug, { includeInactive: false }).catch(
    () => null,
  );

  if (!schema) {
    notFound();
  }

  if (!schema.enabled) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <Sparkles className="mx-auto size-8 stroke-[1.5] text-accent-text" aria-hidden="true" />
        <h1 className="mt-3 font-sans text-2xl font-semibold text-foreground">
          Customization unavailable
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Direct online customization is currently paused for {schema.productName}. Please reach out
          via our concierge chat for private assistance.
        </p>
        <div className="mt-5">
          <Button asChild>
            <Link href={`/products/${schema.productSlug}`}>Return to piece</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/products/${schema.productSlug}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span>Back to {schema.productName}</span>
      </Link>

      <CustomizationFormClient schema={schema} variant="page" />
    </div>
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function CustomizeProductPage({ params }: CustomizeProductPageProps) {
  return (
    <div className="container-default pt-6 pb-28 lg:pb-14">
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-11 w-48" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          </div>
        }
      >
        <CustomizeProductContent params={params} />
      </Suspense>
    </div>
  );
}
