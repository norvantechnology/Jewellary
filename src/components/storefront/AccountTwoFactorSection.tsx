"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { CheckCircle2, Copy, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useUiText } from "@/components/providers/UiTextProvider";
import { FormField } from "@/components/shared/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { authClient } from "@/server/auth-client";

interface AccountTwoFactorSectionProps {
  twoFactorEnabled: boolean;
  hasPasswordAccount: boolean;
  setupRequired?: boolean;
}

function extractTotpSecret(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

export function AccountTwoFactorSection({
  twoFactorEnabled,
  hasPasswordAccount,
  setupRequired = false,
}: AccountTwoFactorSectionProps) {
  const router = useRouter();
  const t = useUiText().account.twoFactor;
  const [enabledOverride, setEnabledOverride] = React.useState<boolean | null>(null);
  const enabled = enabledOverride ?? twoFactorEnabled;
  const [password, setPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [totpUri, setTotpUri] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [disablePassword, setDisablePassword] = React.useState("");
  const [regenPassword, setRegenPassword] = React.useState("");

  async function handleStartEnable(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!password) {
      setErrorMsg(t.passwordRequiredSetup);
      return;
    }

    setBusy(true);
    const res = await authClient.twoFactor.enable({ password });
    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message ?? t.setupError);
      return;
    }

    const data = res.data as { totpURI?: string; backupCodes?: string[] } | null;
    if (!data?.totpURI) {
      setErrorMsg(t.uriError);
      return;
    }

    try {
      const url = await QRCode.toDataURL(data.totpURI, {
        width: 192,
        margin: 1,
        errorCorrectionLevel: "M",
        color: {
          dark: BRAND_PALETTE.light.text,
          light: BRAND_PALETTE.light.surface,
        },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    }

    setTotpUri(data.totpURI);
    setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : null);
    setPassword("");
    toast.success(t.scanToast);
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const code = totpCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      setErrorMsg(t.codeRequired);
      return;
    }

    setBusy(true);
    const res = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message ?? t.codeInvalid);
      return;
    }

    setEnabledOverride(true);
    setTotpUri(null);
    setQrDataUrl(null);
    setTotpCode("");
    toast.success(t.enabledToast);
    router.refresh();
  }

  async function handleRegenerateBackupCodes(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!regenPassword) {
      setErrorMsg(t.passwordRequiredRegen);
      return;
    }

    setBusy(true);
    const res = await authClient.twoFactor.generateBackupCodes({ password: regenPassword });
    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message ?? t.regenError);
      return;
    }

    const data = res.data as { backupCodes?: string[] } | null;
    setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : null);
    setRegenPassword("");
    toast.success(t.regenToast);
  }

  async function handleDisableTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!disablePassword) {
      setErrorMsg(t.passwordRequiredDisable);
      return;
    }

    setBusy(true);
    const res = await authClient.twoFactor.disable({ password: disablePassword });
    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message ?? t.disableError);
      return;
    }

    setEnabledOverride(false);
    setBackupCodes(null);
    setTotpUri(null);
    setQrDataUrl(null);
    setDisablePassword("");
    toast.success(t.disabledToast);
    router.refresh();
  }

  function downloadBackupCodes(codes: string[]) {
    const content = `${t.fileHeading}\n${t.fileGenerated} ${new Date().toISOString()}\n\n${codes.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const secret = totpUri ? extractTotpSecret(totpUri) : null;

  return (
    <section
      id="two-factor"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
            {" "}
            {t.heading}{" "}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground"> {t.intro} </p>
        </div>
        <Badge variant={enabled ? "success" : "outline"} className="gap-1.5">
          {enabled ? (
            <>
              <ShieldCheck className="size-4 stroke-[1.5]" aria-hidden="true" />
              <span>{t.enabledBadge}</span>
            </>
          ) : (
            <span>{t.notEnabledBadge}</span>
          )}
        </Badge>
      </div>

      {setupRequired && !enabled && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-4 text-sm text-foreground"
        >
          <ShieldAlert
            className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">{t.requiredTitle}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t.requiredText}{" "}
              <a
                href="/admin"
                className="font-medium text-accent-text underline underline-offset-4 hover:opacity-80"
              >
                {" "}
                {t.adminStudio}{" "}
              </a>{" "}
              .{" "}
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      )}

      {!hasPasswordAccount ? (
        <p className="mt-4 text-sm text-muted-foreground"> {t.noPasswordText} </p>
      ) : !enabled && !totpUri ? (
        <form onSubmit={handleStartEnable} className="mt-5 max-w-md space-y-4">
          <FormField
            id="tfa-enable-password"
            label={t.confirmPasswordLabel}
            required
            hint={t.confirmPasswordHint}
          >
            {(fp) => (
              <Input
                {...fp}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
          </FormField>
          <Button type="submit" loading={busy}>
            {" "}
            {t.beginSetup}{" "}
          </Button>
        </form>
      ) : !enabled && totpUri ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-2 p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={t.qrAlt}
                  width={192}
                  height={192}
                  // Authenticator scanners require dark modules over a high-contrast light quiet zone even in dark mode.
                  style={{ backgroundColor: BRAND_PALETTE.light.surface }}
                  className="size-48 rounded-md border border-border-strong p-2.5"
                />
              ) : (
                <div className="flex size-48 items-center justify-center text-xs text-muted-foreground">
                  {t.preparingQr}
                </div>
              )}
              {secret && (
                <div className="mt-3 w-full space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">{t.manualKey}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <code
                      data-testid="totp-secret"
                      className="max-w-full min-w-0 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs break-all text-foreground select-all"
                    >
                      {secret}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label={t.copyKeyLabel}
                      onClick={() => {
                        void navigator.clipboard.writeText(secret);
                        toast.success(t.copiedToast);
                      }}
                    >
                      <Copy className="size-5 stroke-[1.5]" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {" "}
                {t.scanInstructions}{" "}
              </p>
              <FormField id="tfa-verify-code" label={t.codeLabel} required>
                {(fp) => (
                  <Input
                    {...fp}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    placeholder={t.codePlaceholder}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>
                  {" "}
                  {t.verifyEnable}{" "}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setTotpUri(null);
                    setTotpCode("");
                  }}
                >
                  {" "}
                  {t.cancel}{" "}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-5 shrink-0 stroke-[1.5]" aria-hidden="true" />
            <span>{t.activeText}</span>
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <form
              onSubmit={handleRegenerateBackupCodes}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <p className="text-sm font-semibold text-foreground">{t.backupHeading}</p>
              <FormField id="tfa-regen-password" label={t.regenPasswordLabel} required>
                {(fp) => (
                  <Input
                    {...fp}
                    type="password"
                    autoComplete="current-password"
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    required
                  />
                )}
              </FormField>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                loading={busy}
                className="min-h-11 sm:min-h-9"
              >
                {" "}
                {t.regenButton}{" "}
              </Button>
            </form>

            <form
              onSubmit={handleDisableTwoFactor}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <p className="text-sm font-semibold text-foreground">{t.disableHeading}</p>
              <FormField id="tfa-disable-password" label={t.disablePasswordLabel} required>
                {(fp) => (
                  <Input
                    {...fp}
                    type="password"
                    autoComplete="current-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                )}
              </FormField>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                loading={busy}
                className="min-h-11 sm:min-h-9"
              >
                {" "}
                {t.disableButton}{" "}
              </Button>
            </form>
          </div>
        </div>
      )}

      {backupCodes && backupCodes.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.saveCodesHeading}</p>
              <p className="text-xs text-muted-foreground"> {t.saveCodesText} </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={() => downloadBackupCodes(backupCodes)}
            >
              <Download className="size-4 stroke-[1.5]" aria-hidden="true" />
              <span>{t.downloadTxt}</span>
            </Button>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-5">
            {backupCodes.map((code) => (
              <li
                key={code}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-center text-foreground"
              >
                {code}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
