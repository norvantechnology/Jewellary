"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { fill, useUiText } from "@/components/providers/UiTextProvider";
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
  const t = useUiText().account.settings;
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
        toast.error(body?.error ?? t.exportError);
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
      toast.success(t.exportDoneToast);
    } catch {
      toast.error(t.downloadError);
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
      toast.success(t.profileSavedToast);
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
      toast.success(t.passwordSavedToast);
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
      toast.success(t.closedToast);
      router.replace("/");
      router.refresh();
    } catch {
      toast.error(t.closeError);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          {" "}
          {t.profileHeading}{" "}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground"> {t.profileIntro} </p>

        <form onSubmit={handleSaveProfile} className="mt-5 max-w-lg space-y-4">
          <FormField id="settings-email" label={t.emailLabel}>
            {(fp) => <Input {...fp} value={profile.email} disabled readOnly />}
          </FormField>

          <FormField
            id="settings-name"
            label={t.nameLabel}
            required
            error={profileErrors.name?.[0]}
          >
            {(fp) => (
              <Input {...fp} value={name} onChange={(e) => setName(e.target.value)} required />
            )}
          </FormField>

          <FormField
            id="settings-phone"
            label={t.phoneLabel}
            hint={t.phoneHint}
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
                placeholder={t.phonePlaceholder}
              />
            )}
          </FormField>

          <Button type="submit" loading={savingProfile}>
            {" "}
            {t.saveProfile}{" "}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          {" "}
          {t.passwordHeading}{" "}
        </h2>
        {profile.hasPasswordAccount ? (
          <form onSubmit={handleChangePassword} className="mt-5 max-w-lg space-y-4">
            <FormField
              id="settings-current-password"
              label={t.currentPasswordLabel}
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
              label={t.newPasswordLabel}
              required
              hint={t.passwordHint}
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
              label={t.confirmPasswordLabel}
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
              {" "}
              {t.updatePassword}{" "}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground"> {t.ssoText} </p>
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
          {" "}
          {t.exportHeading}{" "}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground"> {t.exportIntro} </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            loading={exportingData}
            onClick={() => void handleDownloadData()}
          >
            <Download className="size-5 stroke-[1.5]" aria-hidden="true" />
            <span>{t.exportButton}</span>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/40 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
          {" "}
          {t.closeHeading}{" "}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground"> {t.closeIntro} </p>

        <div className="mt-5 max-w-md space-y-3">
          <FormField
            id="delete-confirm-email"
            label={fill(t.closeConfirmLabel, { email: profile.email })}
          >
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
            {" "}
            {t.closeButton}{" "}
          </Button>
          {profile.role === "ADMIN" && (
            <p className="text-xs text-muted-foreground"> {t.adminCannotClose} </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t.closeDialogTitle}
        description={t.closeDialogText}
        confirmLabel={t.closeDialogConfirm}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDeleteAccount}
      />
    </div>
  );
}
