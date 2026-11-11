import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("faq");
}

export default function FaqPage() {
  return <EditorialContentView slug="faq" />;
}
