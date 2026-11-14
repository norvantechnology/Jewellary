"use client";

import type { SiteContent } from "@/modules/site-content/site-content.shared";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { resetPasswordSchema, type ResetPasswordInput } from "@/modules/auth/auth.schemas";
import { authClient } from "@/server/auth-client";
import { useUiText } from "@/components/providers/UiTextProvider";

interface ResetPasswordFormProps {
  token: string | null;
  /** Card text from site-content.json → pages.auth.resetPassword. */
  copy: Pick<SiteContent["pages"]["auth"]["resetPassword"], "card" | "invalidLink">;
}

export function ResetPasswordForm({ token, copy }: ResetPasswordFormProps) {
  const t = useUiText().auth.resetPassword;
  const [done, setDone] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token ?? "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  if (!token) {
    return (
      <AuthCard
        eyebrow={copy.invalidLink.eyebrow}
        title={copy.invalidLink.title}
        description={copy.invalidLink.description}
      >
        <p className="text-sm text-muted-foreground">{t.invalidText}</p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t.requestNewLink}</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await authClient.resetPassword({
      newPassword: values.newPassword,
      token: values.token,
    });

    if (res.error) {
      setServerError(res.error.message ?? t.resetError);
      return;
    }

    toast.success(t.updatedToast);
    setDone(true);
  });

  return (
    <AuthCard
      eyebrow={copy.card.eyebrow}
      title={copy.card.title}
      description={copy.card.description}
      footer={<AuthHelpLink href="/login">{t.returnToSignIn}</AuthHelpLink>}
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground">{t.doneText}</p>
          <Button asChild className="w-full">
            <Link href="/login">{t.signIn}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("token")} />

          <FormField
            id="reset-new-password"
            label={t.newPasswordLabel}
            required
            hint={t.passwordHint}
            error={form.formState.errors.newPassword?.message}
          >
            {(aria) => (
              <PasswordInput
                autoComplete="new-password"
                {...form.register("newPassword")}
                {...aria}
              />
            )}
          </FormField>

          <FormField
            id="reset-confirm-password"
            label={t.confirmLabel}
            required
            error={form.formState.errors.confirmPassword?.message}
          >
            {(aria) => (
              <PasswordInput
                autoComplete="new-password"
                {...form.register("confirmPassword")}
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
