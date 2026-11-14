import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { AccountCustomizationListClient } from "@/components/storefront/AccountCustomizationListClient";
import { listCustomerCustomizationRequests } from "@/modules/customization/customization.service";
import { requirePageUser } from "@/server/dal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.account.customizations.seo, {
    pathname: "/account/customizations",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountCustomizationsPage() {
  const { user } = await requirePageUser("/account/customizations");
  const ownerKey = `user:${user.id}`;
  const [requests, content] = await Promise.all([
    listCustomerCustomizationRequests({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      isStaff: false,
      guestToken: null,
      primaryOwnerKey: ownerKey,
      allOwnerKeys: [ownerKey],
    }),
    getSiteContent(),
  ]);
  // Visible text: site-content.json → pages.account.customizations
  const t = content.pages.account.customizations;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium tracking-[-0.015em] text-foreground">
          {t.heading}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <AccountCustomizationListClient initialRequests={requests} ownerKey={ownerKey} />
    </div>
  );
}
