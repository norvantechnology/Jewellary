"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COUNTRY_NAMES, formatCountryName } from "@/lib/countries";
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
} from "@/modules/account/account.actions";
import type { SavedAddressDTO } from "@/modules/orders/order.service";

interface AddressFormState {
  id: string | null;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

function emptyAddressForm(): AddressFormState {
  return {
    id: null,
    label: "",
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    isDefaultShipping: false,
    isDefaultBilling: false,
  };
}

function toAddressForm(addr: SavedAddressDTO): AddressFormState {
  return {
    id: addr.id,
    label: addr.label ?? "",
    fullName: addr.fullName,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: addr.country,
    isDefaultShipping: addr.isDefaultShipping,
    isDefaultBilling: addr.isDefaultBilling,
  };
}

export function AccountAddressesClient({
  initialAddresses,
}: {
  initialAddresses: SavedAddressDTO[];
}) {
  const router = useRouter();
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<AddressFormState>(emptyAddressForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = React.useState<SavedAddressDTO | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openNew() {
    setForm(emptyAddressForm());
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(addr: SavedAddressDTO) {
    setForm(toAddressForm(addr));
    setFieldErrors({});
    setDialogOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      const res = await saveAddressAction({
        id: form.id,
        label: form.label || null,
        fullName: form.fullName,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
        isDefaultShipping: form.isDefaultShipping,
        isDefaultBilling: form.isDefaultBilling,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        setFieldErrors(res.error.fieldErrors ?? {});
        return;
      }

      toast.success(form.id ? "Address updated" : "Address added");
      setDialogOpen(false);
      router.refresh();
      // Optimistically reflect state immediately in UI
      setAddresses((prev) => {
        const next = prev.map((a) => ({
          ...a,
          isDefaultShipping: res.data.isDefaultShipping ? false : a.isDefaultShipping,
          isDefaultBilling: res.data.isDefaultBilling ? false : a.isDefaultBilling,
        }));
        const idx = next.findIndex((a) => a.id === res.data.id);
        if (idx >= 0) {
          next[idx] = res.data;
          return next;
        }
        return [res.data, ...next];
      });
    });
  }

  function handleSetDefault(addressId: string, kind: "shipping" | "billing") {
    startTransition(async () => {
      const res = await setDefaultAddressAction({ addressId, kind });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        kind === "shipping"
          ? "Default shipping address updated"
          : "Default billing address updated",
      );
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          isDefaultShipping: kind === "shipping" ? a.id === addressId : a.isDefaultShipping,
          isDefaultBilling: kind === "billing" ? a.id === addressId : a.isDefaultBilling,
        })),
      );
      router.refresh();
    });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const res = await deleteAddressAction({ addressId: id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Address removed");
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium text-foreground">Saved Addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage delivery and billing destinations for faster private checkout.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          <Plus className="mr-1.5 size-4" aria-hidden="true" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses yet"
          description="Save an insured delivery destination so your next commission is pre-filled at checkout."
          actionLabel="Add First Address"
          onAction={openNew}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <article
              key={addr.id}
              className="flex flex-col justify-between rounded-md border border-border bg-card p-5"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg font-medium text-foreground">
                    {addr.label ?? addr.fullName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {addr.isDefaultShipping && <Badge variant="primary">Default Shipping</Badge>}
                    {addr.isDefaultBilling && <Badge variant="outline">Default Billing</Badge>}
                  </div>
                </div>
                <address className="mt-2.5 space-y-0.5 text-sm text-muted-foreground not-italic">
                  <p className="font-medium text-foreground">{addr.fullName}</p>
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>
                    {addr.city}, {addr.state} {addr.postalCode}
                  </p>
                  <p>{formatCountryName(addr.country)}</p>
                  <p className="pt-1 text-xs">{addr.phone}</p>
                </address>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(addr)}>
                  <Pencil className="mr-1 size-3.5" aria-hidden="true" />
                  Edit
                </Button>
                {!addr.isDefaultShipping && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleSetDefault(addr.id, "shipping")}
                  >
                    Set Default Shipping
                  </Button>
                )}
                {!addr.isDefaultBilling && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleSetDefault(addr.id, "billing")}
                  >
                    Set Default Billing
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(addr)}
                  className="ml-auto text-destructive hover:text-destructive"
                  aria-label={`Delete address ${addr.label ?? addr.fullName}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Address" : "Add Delivery Address"}</DialogTitle>
            <DialogDescription>
              Courier insurance requires an accurate recipient name and telephone number.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <FormField id="addr-label" label="Address Label" error={fieldErrors.label?.[0]}>
              {(fp) => (
                <Input
                  {...fp}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Home, Office Vault, Residence"
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="addr-fullname"
                label="Full Name"
                required
                error={fieldErrors.fullName?.[0]}
              >
                {(fp) => (
                  <Input
                    {...fp}
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField id="addr-phone" label="Phone" required error={fieldErrors.phone?.[0]}>
                {(fp) => (
                  <Input
                    {...fp}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                  />
                )}
              </FormField>
            </div>

            <FormField
              id="addr-line1"
              label="Street Address"
              required
              error={fieldErrors.line1?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  value={form.line1}
                  onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                  required
                />
              )}
            </FormField>

            <FormField
              id="addr-line2"
              label="Apartment / Suite (Optional)"
              error={fieldErrors.line2?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  value={form.line2}
                  onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="addr-city" label="City" required error={fieldErrors.city?.[0]}>
                {(fp) => (
                  <Input
                    {...fp}
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField
                id="addr-state"
                label="State / Province"
                required
                error={fieldErrors.state?.[0]}
              >
                {(fp) => (
                  <Input
                    {...fp}
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField
                id="addr-postal"
                label="Postal / ZIP"
                required
                error={fieldErrors.postalCode?.[0]}
              >
                {(fp) => (
                  <Input
                    {...fp}
                    value={form.postalCode}
                    onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                    required
                  />
                )}
              </FormField>
            </div>

            <FormField id="addr-country" label="Country" required error={fieldErrors.country?.[0]}>
              {(fp) => (
                <NativeSelect
                  {...fp}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                >
                  {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="addr-default-shipping"
                  checked={form.isDefaultShipping}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isDefaultShipping: checked === true }))
                  }
                />
                <label
                  htmlFor="addr-default-shipping"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Use as default shipping address
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="addr-default-billing"
                  checked={form.isDefaultBilling}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isDefaultBilling: checked === true }))
                  }
                />
                <label
                  htmlFor="addr-default-billing"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Use as default billing address
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save Address
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Saved Address"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.label ?? deleteTarget.line1}" from your address book? Past order receipts retain their original snapshot.`
            : ""
        }
        confirmLabel="Remove Address"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
