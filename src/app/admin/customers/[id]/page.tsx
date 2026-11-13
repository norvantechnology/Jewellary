import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminCustomerDetailClient } from "@/components/admin/AdminCustomerDetailClient";
import { hasPermission } from "@/lib/permissions";
import { getAdminCustomerDetail } from "@/modules/customers/customer.service";
import { requirePermission } from "@/server/dal";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = {
  title: "Customer Profile",
};

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [actor, { id }] = await Promise.all([requirePermission("customers:read"), params]);

  let customer;
  try {
    customer = await getAdminCustomerDetail(id, actor);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Customers
        </Link>
      </div>

      <AdminCustomerDetailClient
        customer={customer}
        currentActorId={actor.user.id}
        canChangeRole={hasPermission(actor.user.role, "customers:change_role")}
      />
    </div>
  );
}
