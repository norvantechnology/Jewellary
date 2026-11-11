import type { Metadata } from "next";
import { AccountAddressesClient } from "@/components/storefront/AccountAddressesClient";
import { listCustomerAddresses } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Saved Addresses",
};

export default async function AccountAddressesPage() {
  const { user } = await requirePageUser("/account/addresses");
  const addresses = await listCustomerAddresses(user.id);
  return <AccountAddressesClient initialAddresses={addresses} />;
}
