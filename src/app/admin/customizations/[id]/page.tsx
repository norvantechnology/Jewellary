import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminCustomizationDetailClient } from "@/components/admin/AdminCustomizationDetailClient";
import { listCannedReplies } from "@/modules/chat/chat.service";
import {
  getCustomizationRequestDetailForActor,
  getProductCustomizationSchema,
} from "@/modules/customization/customization.service";
import { hasPermission } from "@/lib/permissions";
import { requireStaffPageSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Customization Review",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminCustomizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireStaffPageSession(`/admin/customizations/${encodeURIComponent(id)}`);
  if (!session || !hasPermission(session.user.role, "customization:manage")) {
    redirect("/admin");
  }

  let detail;
  try {
    detail = await getCustomizationRequestDetailForActor(id, {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      role: session.user.role,
      guestToken: null,
      primaryOwnerKey: `user:${session.user.id}`,
      allOwnerKeys: [`user:${session.user.id}`],
      isStaff: true,
    });
  } catch {
    notFound();
  }

  const [productSchema, cannedReplies] = await Promise.all([
    getProductCustomizationSchema(detail.productSlug).catch(() => null),
    listCannedReplies(false),
  ]);

  return (
    <AdminCustomizationDetailClient
      initialDetail={detail}
      productSchema={productSchema}
      cannedReplies={cannedReplies}
    />
  );
}
