"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { AbuseProtectionFields } from "@/components/shared/AbuseProtectionFields";
import { FormField } from "@/components/shared/FormField";
import { useAbuseProtection } from "@/hooks/use-abuse-protection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { registerSchema, type RegisterInput } from "@/modules/auth/auth.schemas";
import { syncGuestCartOnAuthAction } from "@/modules/cart/cart.actions";
import { syncGuestWishlistOnAuthAction } from "@/modules/wishlist/wishlist.actions";
import { authClient } from "@/server/auth-client";

interface RegisterFormProps {
  nextUrl: string;
  googleEnabled: boolean;
}

export function RegisterForm({ nextUrl, googleEnabled }: RegisterFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [googlePending, setGooglePending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const abuse = useAbuseProtection();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const phone = values.phone?.trim() || undefined;
    const res = await authClient.signUp.email(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        phone,
        callbackURL: nextUrl,
      },
      {
        headers: {
          "x-abuse-website": abuse.website,
          "x-abuse-timing": abuse.timingToken,
          "x-abuse-turnstile": abuse.turnstileToken,
        },
      },
    );

    if (res.error) {
      setServerError(res.error.message ?? "Unable to create your account. Please try again.");
      abuse.refreshToken();
      return;
    }

    // Verification is required, so no session exists yet: show the "check your inbox" state.
    const hasSession = Boolean((res.data as { token?: string | null } | null)?.token);
    if (!hasSession) {
      setSentTo(values.email);
      return;
    }

    await Promise.allSettled([syncGuestWishlistOnAuthAction(), syncGuestCartOnAuthAction()]);
    toast.success("Account created.");
    router.replace(nextUrl);
    router.refresh();
  });

  async function handleGoogleSignUp() {
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

  if (sentTo) {
    return (
      <AuthCard
        eyebrow="Client Registration"
        title="Check Your Inbox"
        description="One last step to activate your account."
        footer={
          <span>
            Didn&apos;t get it? <AuthHelpLink href="/verify-email">Resend the link</AuthHelpLink>
          </span>
        }
      >
        <div
          role="status"
          className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-foreground"
        >
          If <strong className="break-all">{sentTo}</strong> is new to us, we&apos;ve sent a
          verification link to it. Open the link to activate your account, then sign in. Your bag
          and wishlist stay saved on this device.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Client Registration"
      title="Create an Account"
      description="Register for saved addresses, lifetime appraisal dossiers, and express checkout."
      footer={
        <span>
          Already registered?{" "}
          <AuthHelpLink href={`/login?next=${encodeURIComponent(nextUrl)}`}>Sign in</AuthHelpLink>
        </span>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          id="register-name"
          label="Full Name"
          required
          error={form.formState.errors.name?.message}
        >
          {(aria) => (
            <Input
              type="text"
              autoComplete="name"
              placeholder="Claire Laurent"
              {...form.register("name")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-email"
          label="Email Address"
          required
          error={form.formState.errors.email?.message}
        >
          {(aria) => (
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="claire@example.com"
              {...form.register("email")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-phone"
          label="Phone Number"
          hint="Optional, used for insured courier delivery coordination"
          error={form.formState.errors.phone?.message}
        >
          {(aria) => (
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 212 555 0140"
              {...form.register("phone")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-password"
          label="Password"
          required
          hint="Minimum 10 characters"
          error={form.formState.errors.password?.message}
        >
          {(aria) => (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              {...form.register("password")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-confirm"
          label="Confirm Password"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          {(aria) => (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              {...form.register("confirmPassword")}
              {...aria}
            />
          )}
        </FormField>

        <div className="space-y-1.5">
          <Controller
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id="register-terms"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={Boolean(form.formState.errors.acceptTerms)}
                  className="shrink-0"
                />
                <Label
                  htmlFor="register-terms"
                  className="cursor-pointer text-sm leading-relaxed font-normal text-muted-foreground"
                >
                  I agree to the{" "}
                  <AuthHelpLink inline href="/terms">
                    Terms of Service
                  </AuthHelpLink>{" "}
                  and{" "}
                  <AuthHelpLink inline href="/privacy">
                    Privacy Policy
                  </AuthHelpLink>
                  .
                </Label>
              </div>
            )}
          />
          {form.formState.errors.acceptTerms?.message && (
            <p role="alert" className="text-xs text-destructive">
              {form.formState.errors.acceptTerms.message}
            </p>
          )}
        </div>

        <AbuseProtectionFields
          website={abuse.website}
          onWebsiteChange={abuse.setWebsite}
          turnstileSiteKey={abuse.turnstileSiteKey}
          onTurnstileToken={abuse.setTurnstileToken}
        />

        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Create Account
        </Button>
      </form>

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
            onClick={handleGoogleSignUp}
          >
            Continue with Google
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
