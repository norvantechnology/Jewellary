import { JsonLd } from "@/components/seo/JsonLd";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/jsonld";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export default async function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPublicStoreSettings();

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd(settings)} />
      <JsonLd data={buildWebSiteJsonLd(settings)} />
      <StorefrontShell>{children}</StorefrontShell>
    </>
  );
}
