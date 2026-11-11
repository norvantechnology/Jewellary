"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/modules/auth/auth.schemas";
import { authClient } from "@/server/auth-client";

export function ForgotPasswordForm() {
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
      setServerError("Too many reset requests. Please try again in a few minutes.");
      return;
    }

    setSubmitted(true);
  });

  return (
    <AuthCard
      eyebrow="Account Recovery"
      title="Reset Password"
      description="Enter your account email and we will send secure password reset instructions."
      footer={<AuthHelpLink href="/login">Return to sign in</AuthHelpLink>}
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {submitted ? (
        <div
          role="status"
          className="space-y-3 rounded-sm border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          <p className="font-medium">Reset Instructions Dispatched</p>
          <p className="text-muted-foreground">
            If an account exists for that email address, we have sent a link to choose a new
            password.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            id="forgot-email"
            label="Email Address"
            required
            error={form.formState.errors.email?.message}
          >
            {(aria) => (
              <Input
                type="email"
                autoComplete="email"
                placeholder="client@example.com"
                {...form.register("email")}
                {...aria}
              />
            )}
          </FormField>

          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
