"use client";

import type { SiteContent } from "@/modules/site-content/site-content.shared";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleAuthButton, OrDivider } from "@/modules/auth/AuthSocial";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { loginSchema, type LoginInput } from "@/modules/auth/auth.schemas";
import { syncGuestCartOnAuthAction } from "@/modules/cart/cart.actions";
import { syncGuestWishlistOnAuthAction } from "@/modules/wishlist/wishlist.actions";
import { authClient } from "@/server/auth-client";
import { useUiText } from "@/components/providers/UiTextProvider";

interface LoginFormProps {
  /** Card text from site-content.json → pages.auth.login. */
  copy: Pick<SiteContent["pages"]["auth"]["login"], "card">;
  nextUrl: string;
  googleEnabled: boolean;
}

export function LoginForm({ nextUrl, googleEnabled, copy }: LoginFormProps) {
  const t = useUiText().auth.login;
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [googlePending, setGooglePending] = React.useState(false);
  const [twoFactorStep, setTwoFactorStep] = React.useState(false);
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [verifyingTwoFactor, setVerifyingTwoFactor] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function finalizeLoginSuccess() {
    await Promise.allSettled([syncGuestWishlistOnAuthAction(), syncGuestCartOnAuthAction()]);
    toast.success(t.signedInToast);
    router.replace(nextUrl);
    router.refresh();
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setNeedsVerification(false);
    const res = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: nextUrl,
    });

    if (res.error) {
      if (res.error.code === "EMAIL_NOT_VERIFIED" || res.error.status === 403) {
        setNeedsVerification(true);
        setServerError(t.verifyFirstError);
        return;
      }
      setServerError(res.error.message ?? t.invalidCredentialsError);
      return;
    }

    const data = res.data as { twoFactorRedirect?: boolean } | null;
    if (data?.twoFactorRedirect) {
      setTwoFactorStep(true);
      setTwoFactorCode("");
      return;
    }

    await finalizeLoginSuccess();
  });

  async function handleVerifySecondFactor(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const code = twoFactorCode.trim();
    if (!code) {
      setServerError(useBackupCode ? t.backupCodeRequiredError : t.totpRequiredError);
      return;
    }

    setVerifyingTwoFactor(true);
    const res = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setVerifyingTwoFactor(false);

    if (res.error) {
      setServerError(res.error.message ?? t.invalidCodeError);
      return;
    }

    await finalizeLoginSuccess();
  }

  async function handleGoogleSignIn() {
    setGooglePending(true);
    setServerError(null);
    const res = await authClient.signIn.social({
      provider: "google",
      callbackURL: nextUrl,
    });
    if (res?.error) {
      setGooglePending(false);
      setServerError(res.error.message ?? t.googleError);
    }
  }

  return (
    <AuthCard
      eyebrow={copy.card.eyebrow}
      title={copy.card.title}
      description={copy.card.description}
      footer={
        <span>
          {t.newClient}{" "}
          <AuthHelpLink href={`/register?next=${encodeURIComponent(nextUrl)}`}>
            {t.createAccount}
          </AuthHelpLink>
        </span>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
          {needsVerification && (
            <>
              {" "}
              <AuthHelpLink href="/verify-email">{t.resendVerification}</AuthHelpLink>
            </>
          )}
        </div>
      )}

      {googleEnabled && !twoFactorStep && (
        <div className="space-y-5">
          <GoogleAuthButton label={t.google} pending={googlePending} onClick={handleGoogleSignIn} />
          <OrDivider label={t.or} />
        </div>
      )}

      {twoFactorStep ? (
        <form onSubmit={handleVerifySecondFactor} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            {useBackupCode ? t.backupCodeIntro : t.totpIntro}
          </p>
          <FormField
            id="login-2fa-code"
            label={useBackupCode ? t.backupCodeLabel : t.totpLabel}
            required
          >
            {(aria) => (
              <Input
                {...aria}
                type="text"
                inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={useBackupCode ? t.backupCodePlaceholder : t.totpPlaceholder}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                required
              />
            )}
          </FormField>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode((prev) => !prev);
                setTwoFactorCode("");
                setServerError(null);
              }}
              className="inline-flex min-h-11 items-center text-accent-text underline underline-offset-4 hover:text-foreground"
            >
              {useBackupCode ? t.useTotp : t.useBackupCode}
            </button>
            <button
              type="button"
              onClick={() => {
                setTwoFactorStep(false);
                setTwoFactorCode("");
                setServerError(null);
              }}
              className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground"
            >
              {t.backToPassword}
            </button>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={verifyingTwoFactor}>
            {t.verifySubmit}
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            id="login-email"
            label={t.emailLabel}
            required
            error={form.formState.errors.email?.message}
          >
            {(aria) => (
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t.emailPlaceholder}
                {...form.register("email")}
                {...aria}
              />
            )}
          </FormField>

          <FormField
            id="login-password"
            label={t.passwordLabel}
            required
            error={form.formState.errors.password?.message}
          >
            {(aria) => (
              <PasswordInput
                autoComplete="current-password"
                placeholder={t.passwordPlaceholder}
                {...form.register("password")}
                {...aria}
              />
            )}
          </FormField>

          <div className="flex items-center justify-end text-xs">
            <AuthHelpLink
              href={
                nextUrl === "/account"
                  ? "/forgot-password"
                  : `/forgot-password?next=${encodeURIComponent(nextUrl)}`
              }
            >
              {t.forgotPassword}
            </AuthHelpLink>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            {t.submit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
