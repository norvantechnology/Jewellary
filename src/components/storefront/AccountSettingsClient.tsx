"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { AccountTwoFactorSection } from "@/components/storefront/AccountTwoFactorSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changePasswordAction,
  requestAccountDeletionAction,
  updateProfileAction,
} from "@/modules/account/account.actions";
import type { AccountProfileDTO } from "@/modules/account/account.service";
import { authClient } from "@/server/auth-client";

export function AccountSettingsClient({
  profile,
  requireTwoFactorPrompt = false,
}: {
  profile: AccountProfileDTO;
  requireTwoFactorPrompt?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(profile.name);
  const [phone, setPhone] = React.useState(profile.phone ?? "");
  const [profileErrors, setProfileErrors] = React.useState<Record<string, string[]>>({});
  const [savingProfile, startSavingProfile] = React.useTransition();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordErrors, setPasswordErrors] = React.useState<Record<string, string[]>>({});
  const [savingPassword, startSavingPassword] = React.useTransition();

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [exportingData, setExportingData] = React.useState(false);

  async function handleDownloadData() {
    setExportingData(true);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Unable to export personal data right now.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `account-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Personal data export downloaded.");
    } catch {
      toast.error("Unable to download personal data right now.");
    } finally {
      setExportingData(false);
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErrors({});
    startSavingProfile(async () => {
      const res = await updateProfileAction({
        name,
        phone: phone || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setProfileErrors(res.error.fieldErrors ?? {});
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordErrors({});
    startSavingPassword(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setPasswordErrors(res.error.fieldErrors ?? {});
        return;
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  async function handleConfirmDeleteAccount() {
    setDeleting(true);
    try {
      const res = await requestAccountDeletionAction({ confirmEmail });
      if (!res.ok) {
        toast.error(res.error.message);
        setDeleting(false);
        return;
      }
      await authClient.signOut();
      toast.success("Your account has been closed and personal details anonymized.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Unable to complete account closure.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          Personal Details
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the client profile used for receipts and private concierge communication.
        </p>

        <form onSubmit={handleSaveProfile} className="mt-5 max-w-lg space-y-4">
          <FormField id="settings-email" label="Email Address">
            {(fp) => <Input {...fp} value={profile.email} disabled readOnly />}
          </FormField>

          <FormField id="settings-name" label="Full Name" required error={profileErrors.name?.[0]}>
            {(fp) => (
              <Input {...fp} value={name} onChange={(e) => setName(e.target.value)} required />
            )}
          </FormField>

          <FormField
            id="settings-phone"
            label="Phone Number"
            hint="Used by armoured courier dispatchers prior to insured delivery."
            error={profileErrors.phone?.[0]}
          >
            {(fp) => (
              <Input
                {...fp}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 234 5678"
              />
            )}
          </FormField>

          <Button type="submit" loading={savingProfile}>
            Save Profile
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          Password &amp; Security
        </h2>
        {profile.hasPasswordAccount ? (
          <form onSubmit={handleChangePassword} className="mt-5 max-w-lg space-y-4">
            <FormField
              id="settings-current-password"
              label="Current Password"
              required
              error={passwordErrors.currentPassword?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              )}
            </FormField>

            <FormField
              id="settings-new-password"
              label="New Password"
              required
              hint="Minimum 10 characters."
              error={passwordErrors.newPassword?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              )}
            </FormField>

            <FormField
              id="settings-confirm-password"
              label="Confirm New Password"
              required
              error={passwordErrors.confirmPassword?.[0]}
            >
              {(fp) => (
                <Input
                  {...fp}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              )}
            </FormField>

            <Button type="submit" variant="outline" loading={savingPassword}>
              Update Password
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Your account signs in via single sign-on provider authentication. Password settings are
            managed by your identity provider.
          </p>
        )}
      </section>

      <AccountTwoFactorSection
        twoFactorEnabled={profile.twoFactorEnabled}
        hasPasswordAccount={profile.hasPasswordAccount}
        setupRequired={requireTwoFactorPrompt}
      />

      <section
        id="data-export"
        className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          Personal Data Export
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Download a portable JSON copy of your client profile, saved shipping and billing
          addresses, order history, saved wishlist items, and studio enquiries.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            loading={exportingData}
            onClick={() => void handleDownloadData()}
          >
            <Download className="size-5 stroke-[1.5]" aria-hidden="true" />
            <span>Download my data</span>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/40 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          Close &amp; Anonymize Account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Closing your account permanently removes saved addresses, wishlists, sessions, and
          personal profile details. Historical order invoices remain anonymized for legal and tax
          record retention.
        </p>

        <div className="mt-5 max-w-md space-y-3">
          <FormField id="delete-confirm-email" label={`Type "${profile.email}" to confirm`}>
            {(fp) => (
              <Input
                {...fp}
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={profile.email}
              />
            )}
          </FormField>

          <Button
            type="button"
            variant="destructive"
            disabled={
              profile.role === "ADMIN" ||
              confirmEmail.trim().toLowerCase() !== profile.email.toLowerCase()
            }
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete My Account
          </Button>
          {profile.role === "ADMIN" && (
            <p className="text-xs text-muted-foreground">
              Administrator accounts cannot be self-deleted. Assign another administrator first.
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirm Permanent Account Deletion"
        description="This action permanently anonymizes your client profile, removes saved addresses and wishlist items, and closes your login credentials. This cannot be undone."
        confirmLabel="Permanently Delete Account"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDeleteAccount}
      />
    </div>
  );
}
