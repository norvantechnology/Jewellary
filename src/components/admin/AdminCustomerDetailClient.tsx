"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { UserRole } from "@/generated/prisma/client";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { adminChangeCustomerRoleAction } from "@/modules/customers/customer.actions";
import type { AdminCustomerDetailDTO } from "@/modules/customers/customer.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";

interface AdminCustomerDetailClientProps {
  customer: AdminCustomerDetailDTO;
  currentActorId: string;
  canChangeRole: boolean;
}

export function AdminCustomerDetailClient({
  customer,
  currentActorId,
  canChangeRole,
}: AdminCustomerDetailClientProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(customer.role);
  const [reason, setReason] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const isSelfDemotion = customer.id === currentActorId && selectedRole !== "ADMIN";

  async function handleConfirmRoleChange() {
    setSaving(true);
    try {
      const res = await adminChangeCustomerRoleAction({
        userId: customer.id,
        role: selectedRole,
        reason: reason || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setSaving(false);
        return;
      }
      toast.success(`Role updated to ${res.data.role}`);
      setConfirmOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-editorial-label text-accent-text">Client Profile</span>
            <Badge variant={customer.role === "ADMIN" ? "primary" : "outline"}>
              {customer.role}
            </Badge>
            {customer.anonymizedAt && <Badge variant="destructive">Anonymized</Badge>}
          </div>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground sm:text-4xl">
            {customer.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customer.email} · Joined {formatDate(customer.createdAt)}
          </p>
        </div>

        {customer.piiMasked && (
          <div className="flex items-center gap-2 rounded-sm border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <span>Sensitive phone &amp; street fields masked for Staff tier.</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-5">
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Total Orders</p>
          <p className="mt-1 font-display text-3xl font-medium text-foreground tabular-nums-price">
            {customer.orderCount}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Lifetime Spend</p>
          <p className="mt-1 font-display text-3xl font-medium text-foreground tabular-nums-price">
            {formatMoneyExact(customer.lifetimeSpend, customer.currency)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Telephone</p>
          <p className="mt-1 font-display text-xl font-medium text-foreground">
            {customer.phone ?? "Not provided"}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Order History</h2>
            {customer.orders.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No orders associated with this account.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {customer.orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ORDER_STATUS_META[order.status].badgeVariant}>
                        {ORDER_STATUS_META[order.status].label}
                      </Badge>
                      <span className="font-medium tabular-nums-price">
                        {formatMoneyExact(order.total, order.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-6">
            <h2 className="font-display text-2xl font-medium text-foreground">Saved Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No saved addresses on file.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="rounded-sm border border-border p-4 text-sm">
                    <p className="font-medium text-foreground">{addr.label ?? addr.fullName}</p>
                    <p className="mt-1 text-muted-foreground">{addr.line1}</p>
                    <p className="text-muted-foreground">
                      {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p className="text-muted-foreground">{formatCountryName(addr.country)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{addr.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          {canChangeRole && !customer.anonymizedAt && (
            <section className="rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-xl font-medium text-foreground">Role Governance</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Administrator-only access assignment. All changes write to the security audit log.
              </p>

              <div className="mt-4 space-y-4">
                <FormField id="customer-role-select" label="Assigned Role">
                  {(fp) => (
                    <NativeSelect
                      {...fp}
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    >
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </NativeSelect>
                  )}
                </FormField>

                <FormField id="role-change-reason" label="Audit Reason (Optional)">
                  {(fp) => (
                    <Input
                      {...fp}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Onboarding atelier advisor..."
                    />
                  )}
                </FormField>

                {isSelfDemotion && (
                  <p className="text-xs text-destructive">
                    You cannot demote your own active administrator session.
                  </p>
                )}

                <Button
                  type="button"
                  disabled={selectedRole === customer.role || isSelfDemotion}
                  onClick={() => setConfirmOpen(true)}
                  className="w-full"
                >
                  Update Role
                </Button>
              </div>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Account Role Update"
        description={`Change ${customer.email} from ${customer.role} to ${selectedRole}?`}
        confirmLabel="Confirm Role Change"
        destructive={selectedRole === "ADMIN"}
        loading={saving}
        onConfirm={handleConfirmRoleChange}
      />
    </div>
  );
}
