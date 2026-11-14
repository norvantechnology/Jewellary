import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata } from "@/modules/site-content/site-content.service";
import { AccountAddressesClient } from "@/components/storefront/AccountAddressesClient";
import { listCustomerAddresses } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.account.addresses.seo, {
    pathname: "/account/addresses",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountAddressesPage() {
  const { user } = await requirePageUser("/account/addresses");
  const addresses = await listCustomerAddresses(user.id);
  return <AccountAddressesClient initialAddresses={addresses} />;
}
