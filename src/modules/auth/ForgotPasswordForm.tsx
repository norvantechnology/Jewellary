"use client";

import type { SiteContent } from "@/modules/site-content/site-content.shared";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/modules/auth/auth.schemas";
import { authClient } from "@/server/auth-client";
import { useUiText } from "@/components/providers/UiTextProvider";

export function ForgotPasswordForm({
  nextUrl = "/account",
  copy,
}: {
  nextUrl?: string;
  /** Card text from site-content.json → pages.auth.forgotPassword. */
  copy: Pick<SiteContent["pages"]["auth"]["forgotPassword"], "card">;
}) {
  const loginHref =
    nextUrl === "/account" ? "/login" : `/login?next=${encodeURIComponent(nextUrl)}`;
  const t = useUiText().auth.forgotPassword;
  const [submitted, setSubmitted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password";

    const res = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo,
    });

    if (res.error && res.error.status === 429) {
      setServerError(t.rateLimitError);
      return;
    }

    setSubmitted(true);
  });

  return (
    <AuthCard
      eyebrow={copy.card.eyebrow}
      title={copy.card.title}
      description={copy.card.description}
      footer={<AuthHelpLink href={loginHref}>{t.returnToSignIn}</AuthHelpLink>}
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {submitted ? (
        <div
          role="status"
          className="space-y-2 rounded-md border border-border bg-surface-2 p-4 text-sm text-foreground"
        >
          <p className="font-semibold">{t.sentTitle}</p>
          <p className="text-muted-foreground">{t.sentText}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            id="forgot-email"
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

          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            {t.submit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
