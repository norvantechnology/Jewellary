import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("ring-size-guide");
}

export default function RingSizeGuidePage() {
  return <EditorialContentView slug="ring-size-guide" />;
}
