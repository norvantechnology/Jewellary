"use client";

import type { SiteContent } from "@/modules/site-content/site-content.shared";

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
import { useUiText } from "@/components/providers/UiTextProvider";

interface RegisterFormProps {
  /** Card text from site-content.json → pages.auth.register. */
  copy: Pick<SiteContent["pages"]["auth"]["register"], "card" | "checkInbox">;
  nextUrl: string;
  googleEnabled: boolean;
}

export function RegisterForm({ nextUrl, googleEnabled, copy }: RegisterFormProps) {
  const t = useUiText().auth.register;
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
      setServerError(res.error.message ?? t.createError);
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
    toast.success(t.createdToast);
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
      setServerError(res.error.message ?? t.googleError);
    }
  }

  if (sentTo) {
    return (
      <AuthCard
        eyebrow={copy.checkInbox.eyebrow}
        title={copy.checkInbox.title}
        description={copy.checkInbox.description}
        footer={
          <span>
            {t.didntGetIt} <AuthHelpLink href="/verify-email">{t.resendLink}</AuthHelpLink>
          </span>
        }
      >
        <div
          role="status"
          className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-foreground"
        >
          {t.sentBefore} <strong className="break-all">{sentTo}</strong> {t.sentAfter}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={copy.card.eyebrow}
      title={copy.card.title}
      description={copy.card.description}
      footer={
        <span>
          {t.alreadyRegistered}{" "}
          <AuthHelpLink href={`/login?next=${encodeURIComponent(nextUrl)}`}>
            {t.signIn}
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
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          id="register-name"
          label={t.nameLabel}
          required
          error={form.formState.errors.name?.message}
        >
          {(aria) => (
            <Input
              type="text"
              autoComplete="name"
              placeholder={t.namePlaceholder}
              {...form.register("name")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-email"
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
          id="register-phone"
          label={t.phoneLabel}
          hint={t.phoneHint}
          error={form.formState.errors.phone?.message}
        >
          {(aria) => (
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t.phonePlaceholder}
              {...form.register("phone")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-password"
          label={t.passwordLabel}
          required
          hint={t.passwordHint}
          error={form.formState.errors.password?.message}
        >
          {(aria) => (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t.passwordPlaceholder}
              {...form.register("password")}
              {...aria}
            />
          )}
        </FormField>

        <FormField
          id="register-confirm"
          label={t.confirmLabel}
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          {(aria) => (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t.confirmPlaceholder}
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
                  {t.termsPrefix}{" "}
                  <AuthHelpLink inline href="/terms">
                    {t.termsLink}
                  </AuthHelpLink>{" "}
                  {t.termsAnd}{" "}
                  <AuthHelpLink inline href="/privacy">
                    {t.privacyLink}
                  </AuthHelpLink>
                  {t.termsSuffix}
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
          {t.submit}
        </Button>
      </form>

      {googleEnabled && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs tracking-wider text-muted-foreground uppercase">{t.or}</span>
            <Separator className="flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={googlePending}
            onClick={handleGoogleSignUp}
          >
            {t.google}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
