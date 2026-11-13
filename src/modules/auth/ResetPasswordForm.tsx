"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { resetPasswordSchema, type ResetPasswordInput } from "@/modules/auth/auth.schemas";
import { authClient } from "@/server/auth-client";

interface ResetPasswordFormProps {
  token: string | null;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
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
        eyebrow="Account Recovery"
        title="Reset Link Invalid"
        description="This password reset link is missing or has expired."
      >
        <p className="text-sm text-muted-foreground">
          Please request a fresh password reset email to continue.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request New Reset Link</Link>
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
      setServerError(res.error.message ?? "Unable to reset password. Request a fresh link.");
      return;
    }

    toast.success("Your password has been updated");
    setDone(true);
  });

  return (
    <AuthCard
      eyebrow="Account Recovery"
      title="Choose New Password"
      description="Create a strong new password of at least 10 characters."
      footer={<AuthHelpLink href="/login">Return to sign in</AuthHelpLink>}
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
          <p className="text-sm text-foreground">
            Your password has been updated successfully. You may now sign in with your new
            credentials.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("token")} />

          <FormField
            id="reset-new-password"
            label="New Password"
            required
            hint="Minimum 10 characters"
            error={form.formState.errors.newPassword?.message}
          >
            {(aria) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register("newPassword")}
                {...aria}
              />
            )}
          </FormField>

          <FormField
            id="reset-confirm-password"
            label="Confirm New Password"
            required
            error={form.formState.errors.confirmPassword?.message}
          >
            {(aria) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register("confirmPassword")}
                {...aria}
              />
            )}
          </FormField>

          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            Update Password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
