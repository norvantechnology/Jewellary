import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("care-guide");
}

export default function CareGuidePage() {
  return <EditorialContentView slug="care-guide" />;
}
