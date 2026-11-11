import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("privacy");
}

export default function PrivacyPage() {
  return <EditorialContentView slug="privacy" />;
}
