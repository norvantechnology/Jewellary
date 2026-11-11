import type { Metadata } from "next";
import { AccountSettingsClient } from "@/components/storefront/AccountSettingsClient";
import { getAccountProfile } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Account Settings",
};

export default async function AccountSettingsPage() {
  const { user } = await requirePageUser("/account/settings");
  const profile = await getAccountProfile(user.id);
  return <AccountSettingsClient profile={profile} />;
}
