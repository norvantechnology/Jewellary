import { JsonLd } from "@/components/seo/JsonLd";
import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialContentPage, getEditorialMetadata } from "@/lib/content";
import { buildJewelryStoreJsonLd, buildWebPageJsonLd } from "@/lib/seo/jsonld";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export async function generateMetadata() {
  return getEditorialMetadata("about");
}

export default async function AboutPage() {
  const [page, settings] = await Promise.all([
    getEditorialContentPage("about"),
    getPublicStoreSettings(),
  ]);
  const aboutJsonLd = buildWebPageJsonLd({
    type: "AboutPage",
    name: page.title,
    description: page.description,
    path: "/about",
    settings,
  });
  const jewelryStoreJsonLd = buildJewelryStoreJsonLd(settings);

  return (
    <>
      <JsonLd data={aboutJsonLd} />
      {jewelryStoreJsonLd && <JsonLd data={jewelryStoreJsonLd} />}
      <EditorialContentView slug="about" />
    </>
  );
}
