import type { Metadata } from "next";
import { AccountCustomizationListClient } from "@/components/storefront/AccountCustomizationListClient";
import { listCustomerCustomizationRequests } from "@/modules/customization/customization.service";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Customization Requests",
};

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountCustomizationsPage() {
  const { user } = await requirePageUser("/account/customizations");
  const ownerKey = `user:${user.id}`;
  const requests = await listCustomerCustomizationRequests({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    isStaff: false,
    guestToken: null,
    primaryOwnerKey: ownerKey,
    allOwnerKeys: [ownerKey],
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-serif text-2xl font-medium tracking-[-0.015em] text-foreground">
          Customization Requests
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your bespoke commission specifications, atelier quotations, and concierge thread
          updates.
        </p>
      </div>

      <AccountCustomizationListClient initialRequests={requests} ownerKey={ownerKey} />
    </div>
  );
}
