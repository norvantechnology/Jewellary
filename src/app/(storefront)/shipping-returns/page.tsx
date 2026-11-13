import { JsonLd } from "@/components/seo/JsonLd";
import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";
import { buildOrganizationJsonLd } from "@/lib/seo/jsonld";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata() {
  return getEditorialMetadata("shipping-returns");
}

export default async function ShippingReturnsPage() {
  const [settings, zones] = await Promise.all([
    getPublicStoreSettings(),
    getAllShippingZones(true),
  ]);
  const defaultZone =
    zones.find((z) => z.countries.includes(settings.defaultCountry)) ?? zones[0] ?? null;

  return (
    <>
      <JsonLd
        data={buildOrganizationJsonLd(settings, {
          shippingZones: defaultZone ? [defaultZone] : zones,
          includeShippingPolicy: true,
        })}
      />
      <EditorialContentView slug="shipping-returns" />
    </>
  );
}
