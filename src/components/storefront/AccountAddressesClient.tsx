"use client";

import * as React from "react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RevealStagger } from "@/components/motion/Reveal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import {
  CountrySelectField,
  PhoneWithDialCodeInput,
  StateRegionField,
} from "@/components/storefront/AddressCountryFields";
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
import {
  formatCountryName,
  getCountryMeta,
  getCountryStates,
  validatePhoneNumber,
  validatePostalCodeForCountry,
} from "@/lib/countries";
import { fadeInVariants, MOTION_TRANSITIONS, useReducedMotionSafe } from "@/lib/motion";
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
} from "@/modules/account/account.actions";
import type { SavedAddressDTO } from "@/modules/orders/order.service";

const MAX_SAVED_ADDRESSES = 10;
const LABEL_PRESETS = ["Home", "Work", "Other"] as const;

interface AddressFormState {
  id: string | null;
  labelPreset: (typeof LABEL_PRESETS)[number];
  customLabel: string;
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
    labelPreset: "Home",
    customLabel: "",
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
  const rawLabel = (addr.label ?? "").trim();
  const isHome = rawLabel.toLowerCase() === "home";
  const isWork = rawLabel.toLowerCase() === "work";
  const labelPreset: (typeof LABEL_PRESETS)[number] = isHome
    ? "Home"
    : isWork
      ? "Work"
      : rawLabel
        ? "Other"
        : "Home";

  return {
    id: addr.id,
    labelPreset,
    customLabel: labelPreset === "Other" && rawLabel.toLowerCase() !== "other" ? rawLabel : "",
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
  const reducedMotion = useReducedMotionSafe();
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<AddressFormState>(emptyAddressForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = React.useState<SavedAddressDTO | null>(null);
  const [pending, startTransition] = React.useTransition();

  const atLimit = addresses.length >= MAX_SAVED_ADDRESSES;
  const countryMeta = getCountryMeta(form.country);

  function openNew() {
    if (atLimit) {
      toast.error(`You can save up to ${MAX_SAVED_ADDRESSES} addresses.`);
      return;
    }
    setForm(emptyAddressForm());
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(addr: SavedAddressDTO) {
    setForm(toAddressForm(addr));
    setFieldErrors({});
    setDialogOpen(true);
  }

  function validateClientFields(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (form.fullName.trim().length < 2) {
      errors.fullName = ["Full name is required."];
    }
    const phoneErr = validatePhoneNumber(form.phone);
    if (phoneErr) {
      errors.phone = [phoneErr];
    }
    if (form.line1.trim().length < 3) {
      errors.line1 = ["Street address is required."];
    }
    if (form.city.trim().length < 2) {
      errors.city = ["City is required."];
    }
    if (form.state.trim().length < 1) {
      errors.state = [`${countryMeta?.stateLabel ?? "State / Province"} is required.`];
    }
    const postalErr = validatePostalCodeForCountry(form.postalCode, form.country);
    if (postalErr) {
      errors.postalCode = [postalErr];
    }
    return errors;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validateClientFields();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      toast.error("Please fix the highlighted address fields.");
      return;
    }
    setFieldErrors({});

    const resolvedLabel =
      form.labelPreset === "Other" ? form.customLabel.trim() || "Other" : form.labelPreset;

    startTransition(async () => {
      const res = await saveAddressAction({
        id: form.id,
        label: resolvedLabel,
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

      const saved = res.data as SavedAddressDTO;
      setAddresses((prev) => {
        const next = prev.map((a) => ({
          ...a,
          isDefaultShipping: saved.isDefaultShipping ? false : a.isDefaultShipping,
          isDefaultBilling: saved.isDefaultBilling ? false : a.isDefaultBilling,
        }));
        const idx = next.findIndex((a) => a.id === saved.id);
        if (idx >= 0) {
          next[idx] = saved;
          return next;
        }
        return [saved, ...next];
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
    const deleted = deleteTarget;
    const res = await deleteAddressAction({ addressId: deleted.id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Address removed");
    setAddresses((prev) => {
      const remaining = prev.filter((a) => a.id !== deleted.id);
      const first = remaining[0];
      if (!first) return remaining;
      if (deleted.isDefaultShipping || deleted.isDefaultBilling) {
        return [
          {
            ...first,
            isDefaultShipping: deleted.isDefaultShipping ? true : first.isDefaultShipping,
            isDefaultBilling: deleted.isDefaultBilling ? true : first.isDefaultBilling,
          },
          ...remaining.slice(1),
        ];
      }
      return remaining;
    });
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div>
          <h2 className="type-h3 font-semibold text-foreground">Saved Addresses</h2>
          <p className="tabular-nums-price mt-1 text-sm text-muted-foreground">
            Manage delivery destinations for faster checkout ({addresses.length} /{" "}
            {MAX_SAVED_ADDRESSES} saved).
          </p>
        </div>
        <Button
          type="button"
          onClick={openNew}
          disabled={atLimit}
          className="min-h-11 w-full sm:min-h-10 sm:w-auto"
        >
          <Plus className="size-5 stroke-[1.5]" aria-hidden="true" />
          <span>{atLimit ? "Limit Reached (10)" : "Add Address"}</span>
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses yet"
          description="Save an insured delivery destination so your next order is pre-filled at checkout."
          actionLabel="Add First Address"
          onAction={openNew}
        />
      ) : (
        <RevealStagger className="grid gap-4 md:grid-cols-2 lg:gap-6">
          <AnimatePresence initial={false}>
            {addresses.map((addr) => (
              <m.article
                key={addr.id}
                initial={false}
                exit={
                  reducedMotion
                    ? { opacity: 0, transition: MOTION_TRANSITIONS.reduced }
                    : { opacity: 0, scale: 0.96, transition: MOTION_TRANSITIONS.fast }
                }
                className="ma-card-elevate flex flex-col justify-between rounded-xl border border-border bg-card p-4 sm:p-6"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-semibold text-foreground">
                      {addr.label ?? "Saved Destination"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {addr.isDefaultShipping ? (
                          <m.span
                            key="ship-default"
                            variants={fadeInVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="inline-flex"
                          >
                            <Badge variant="primary">Default</Badge>
                          </m.span>
                        ) : null}
                      </AnimatePresence>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {addr.isDefaultBilling ? (
                          <m.span
                            key="bill-default"
                            variants={fadeInVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="inline-flex"
                          >
                            <Badge variant="outline">Default Billing</Badge>
                          </m.span>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                  <address className="mt-2.5 space-y-0.5 text-sm leading-relaxed break-words text-muted-foreground not-italic">
                    <p className="font-semibold text-foreground">{addr.fullName}</p>
                    <p>{addr.line1}</p>
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>
                      {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p>{formatCountryName(addr.country)}</p>
                    <p className="tabular-nums-price pt-1 text-xs">{addr.phone}</p>
                  </address>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(addr)}
                    className="min-h-11 sm:min-h-9"
                  >
                    <Pencil className="size-4 stroke-[1.5]" aria-hidden="true" />
                    <span>Edit</span>
                  </Button>
                  {!addr.isDefaultShipping && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleSetDefault(addr.id, "shipping")}
                      className="min-h-11 sm:min-h-9"
                    >
                      Set as default
                    </Button>
                  )}
                  {!addr.isDefaultBilling && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleSetDefault(addr.id, "billing")}
                      className="min-h-11 sm:min-h-9"
                    >
                      Set Default Billing
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteTarget(addr)}
                    className="ml-auto min-h-11 min-w-11 text-muted-foreground hover:text-destructive sm:min-h-9 sm:min-w-9"
                    aria-label={`Delete address ${addr.label ?? addr.fullName}`}
                  >
                    <Trash2 className="size-5 stroke-[1.5]" aria-hidden="true" />
                  </Button>
                </div>
              </m.article>
            ))}
          </AnimatePresence>
        </RevealStagger>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Address" : "Add Delivery Address"}</DialogTitle>
            <DialogDescription>
              Courier insurance requires an accurate recipient name and telephone number.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Address Label</span>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Address label preset"
              >
                {LABEL_PRESETS.map((preset) => {
                  const active = form.labelPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, labelPreset: preset }))}
                      className={`min-h-11 cursor-pointer rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent sm:min-h-10 ${
                        active
                          ? "border-accent bg-accent-tint text-text"
                          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
              {form.labelPreset === "Other" && (
                <FormField
                  id="addr-label"
                  label="Custom Label (Optional)"
                  error={fieldErrors.label?.[0]}
                >
                  {(fp) => (
                    <Input
                      {...fp}
                      value={form.customLabel}
                      onChange={(e) => setForm((f) => ({ ...f, customLabel: e.target.value }))}
                      placeholder="e.g. Residence, Safe Deposit, Studio"
                    />
                  )}
                </FormField>
              )}
            </div>

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <FormField
                id="addr-fullname"
                label="Full Name"
                required
                error={fieldErrors.fullName?.[0]}
              >
                {(fp) => (
                  <Input
                    {...fp}
                    autoComplete="shipping name"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                  />
                )}
              </FormField>

              <FormField
                id="addr-country"
                label="Country"
                required
                error={fieldErrors.country?.[0]}
              >
                {(fp) => (
                  <CountrySelectField
                    id={fp.id}
                    value={form.country}
                    inModal
                    ariaDescribedBy={fp["aria-describedby"]}
                    onChange={(nextCountry) => {
                      const nextStates = getCountryStates(nextCountry);
                      setForm((f) => ({
                        ...f,
                        country: nextCountry,
                        state: nextStates.length > 0 ? "" : f.state,
                      }));
                    }}
                  />
                )}
              </FormField>
            </div>

            <FormField id="addr-phone" label="Phone Number" required error={fieldErrors.phone?.[0]}>
              {(fp) => (
                <PhoneWithDialCodeInput
                  id={fp.id}
                  country={form.country}
                  value={form.phone}
                  autoComplete="shipping tel"
                  ariaDescribedBy={fp["aria-describedby"]}
                  ariaInvalid={Boolean(fieldErrors.phone?.[0])}
                  required
                  onChange={(fullPhone) => {
                    setForm((f) => ({ ...f, phone: fullPhone }));
                    if (fieldErrors.phone) {
                      const err = validatePhoneNumber(fullPhone);
                      setFieldErrors((prev) => ({
                        ...prev,
                        phone: err ? [err] : [],
                      }));
                    }
                  }}
                />
              )}
            </FormField>

            <FormField
              id="addr-line1"
              label="Street Address"
              required
              error={fieldErrors.line1?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  autoComplete="shipping address-line1"
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
                  autoComplete="shipping address-line2"
                  value={form.line2}
                  onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                />
              )}
            </FormField>

            <div className="grid gap-4 min-[480px]:grid-cols-2 sm:grid-cols-3">
              <FormField id="addr-city" label="City" required error={fieldErrors.city?.[0]}>
                {(fp) => (
                  <Input
                    {...fp}
                    autoComplete="shipping address-level2"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField
                id="addr-state"
                label={countryMeta?.stateLabel ?? "State / Province"}
                required
                error={fieldErrors.state?.[0]}
              >
                {(fp) => (
                  <StateRegionField
                    id={fp.id}
                    country={form.country}
                    value={form.state}
                    autoComplete="shipping address-level1"
                    inModal
                    required
                    ariaDescribedBy={fp["aria-describedby"]}
                    ariaInvalid={Boolean(fieldErrors.state?.[0])}
                    onChange={(nextState) => setForm((f) => ({ ...f, state: nextState }))}
                  />
                )}
              </FormField>
              <FormField
                id="addr-postal"
                label="Postal / ZIP"
                required
                hint={countryMeta ? `e.g. ${countryMeta.postalExample}` : undefined}
                error={fieldErrors.postalCode?.[0]}
              >
                {(fp) => (
                  <Input
                    {...fp}
                    autoComplete="shipping postal-code"
                    value={form.postalCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({ ...f, postalCode: val }));
                      if (fieldErrors.postalCode) {
                        const err = validatePostalCodeForCountry(val, form.country);
                        setFieldErrors((prev) => ({
                          ...prev,
                          postalCode: err ? [err] : [],
                        }));
                      }
                    }}
                    required
                  />
                )}
              </FormField>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex min-h-11 items-center gap-3">
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
              <div className="flex min-h-11 items-center gap-3">
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
                className="min-h-11 sm:min-h-10"
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending} className="min-h-11 sm:min-h-10">
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
