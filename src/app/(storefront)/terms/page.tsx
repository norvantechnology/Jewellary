import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("terms");
}

export default function TermsPage() {
  return <EditorialContentView slug="terms" />;
}
