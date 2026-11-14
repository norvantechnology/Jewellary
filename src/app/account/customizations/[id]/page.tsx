import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata } from "@/modules/site-content/site-content.service";
import { notFound } from "next/navigation";
import { AccountCustomizationDetailClient } from "@/components/storefront/AccountCustomizationDetailClient";
import {
  getCustomizationRequestDetailForActor,
  getProductCustomizationSchema,
} from "@/modules/customization/customization.service";
import { requirePageUser } from "@/server/dal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.account.customizationDetail.seo, {
    pathname: "/account/customizations",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountCustomizationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { user } = await requirePageUser(`/account/customizations/${encodeURIComponent(id)}`);
  const ownerKey = `user:${user.id}`;

  const detail = await getCustomizationRequestDetailForActor(id, {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    isStaff: false,
    guestToken: null,
    primaryOwnerKey: ownerKey,
    allOwnerKeys: [ownerKey],
  }).catch(() => null);

  if (!detail) {
    notFound();
  }

  const productSchema =
    detail.status === "SUBMITTED"
      ? await getProductCustomizationSchema(detail.productId, {
          includeInactive: false,
        }).catch(() => null)
      : null;

  return (
    <AccountCustomizationDetailClient
      initialDetail={detail}
      productSchema={productSchema}
      ownerKey={ownerKey}
    />
  );
}
