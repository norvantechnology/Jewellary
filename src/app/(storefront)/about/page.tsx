import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("about");
}

export default function AboutPage() {
  return <EditorialContentView slug="about" />;
}
