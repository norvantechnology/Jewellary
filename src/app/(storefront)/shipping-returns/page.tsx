import { EditorialContentView } from "@/components/storefront/EditorialContentView";
import { getEditorialMetadata } from "@/lib/content";

export async function generateMetadata() {
  return getEditorialMetadata("shipping-returns");
}

export default function ShippingReturnsPage() {
  return <EditorialContentView slug="shipping-returns" />;
}
