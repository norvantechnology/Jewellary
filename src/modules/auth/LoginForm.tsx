"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { loginSchema, type LoginInput } from "@/modules/auth/auth.schemas";
import { syncGuestCartOnAuthAction } from "@/modules/cart/cart.actions";
import { syncGuestWishlistOnAuthAction } from "@/modules/wishlist/wishlist.actions";
import { authClient } from "@/server/auth-client";

interface LoginFormProps {
  nextUrl: string;
  googleEnabled: boolean;
}

export function LoginForm({ nextUrl, googleEnabled }: LoginFormProps) {
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
    toast.success("Signed in");
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
        setServerError("Please verify your email before signing in.");
        return;
      }
      setServerError(res.error.message ?? "Invalid email or password.");
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
      setServerError(
        useBackupCode
          ? "Enter a valid backup recovery code."
          : "Enter the 6-digit code from your authenticator app.",
      );
      return;
    }

    setVerifyingTwoFactor(true);
    const res = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setVerifyingTwoFactor(false);

    if (res.error) {
      setServerError(res.error.message ?? "Invalid verification code.");
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
      setServerError(res.error.message ?? "Unable to continue with Google.");
    }
  }

  return (
    <AuthCard
      eyebrow="Client Access"
      title="Welcome Back"
      description="Sign in to view your saved jewellery dossier, wishlist, and insured orders."
      footer={
        <span>
          New client?{" "}
          <AuthHelpLink href={`/register?next=${encodeURIComponent(nextUrl)}`}>
            Create an account
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
              <AuthHelpLink href="/verify-email">Send a new verification link</AuthHelpLink>
            </>
          )}
        </div>
      )}

      {twoFactorStep ? (
        <form onSubmit={handleVerifySecondFactor} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            {useBackupCode
              ? "Enter one of your single-use backup recovery codes to complete sign-in."
              : "Enter the 6-digit verification code from your authenticator application."}
          </p>
          <FormField
            id="login-2fa-code"
            label={useBackupCode ? "Backup Recovery Code" : "6-Digit Authenticator Code"}
            required
          >
            {(aria) => (
              <Input
                {...aria}
                type="text"
                inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={useBackupCode ? "xxxxx-xxxxx" : "123456"}
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
              {useBackupCode ? "Use authenticator app code instead" : "Use a backup code"}
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
              Back to password
            </button>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={verifyingTwoFactor}>
            Verify &amp; Sign In
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            id="login-email"
            label="Email Address"
            required
            error={form.formState.errors.email?.message}
          >
            {(aria) => (
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="client@example.com"
                {...form.register("email")}
                {...aria}
              />
            )}
          </FormField>

          <FormField
            id="login-password"
            label="Password"
            required
            error={form.formState.errors.password?.message}
          >
            {(aria) => (
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
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
              Forgot password?
            </AuthHelpLink>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            Sign In
          </Button>
        </form>
      )}

      {googleEnabled && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs tracking-wider text-muted-foreground uppercase">Or</span>
            <Separator className="flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={googlePending}
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
