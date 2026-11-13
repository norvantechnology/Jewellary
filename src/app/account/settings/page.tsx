import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountSettingsClient } from "@/components/storefront/AccountSettingsClient";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountProfile } from "@/modules/account/account.service";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Account Settings",
};

async function AccountSettingsBody({
  searchParams,
}: {
  searchParams: Promise<{ setup2fa?: string }>;
}) {
  const [{ user }, sp] = await Promise.all([requirePageUser("/account/settings"), searchParams]);
  const profile = await getAccountProfile(user.id);
  return <AccountSettingsClient profile={profile} requireTwoFactorPrompt={sp.setup2fa === "1"} />;
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ setup2fa?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <AccountSettingsBody searchParams={searchParams} />
    </Suspense>
  );
}
