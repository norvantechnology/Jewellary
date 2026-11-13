"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { AuthCard, AuthHelpLink } from "@/modules/auth/AuthCard";
import {
  resendVerificationSchema,
  type ResendVerificationInput,
} from "@/modules/auth/auth.schemas";
import { authClient } from "@/server/auth-client";

interface VerifyEmailPanelProps {
  token: string | null;
}

export function VerifyEmailPanel({ token }: VerifyEmailPanelProps) {
  const [status, setStatus] = React.useState<"idle" | "verifying" | "verified" | "error">(
    token ? "verifying" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    let active = true;

    async function run() {
      const res = await authClient.verifyEmail({
        query: { token: token! },
      });
      if (!active) return;
      if (res.error) {
        setStatus("error");
        setErrorMessage(res.error.message ?? "Verification link is invalid or expired.");
      } else {
        setStatus("verified");
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [token]);

  const form = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: "" },
  });

  const onResend = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    const res = await authClient.sendVerificationEmail({
      email: values.email,
      callbackURL: "/account",
    });
    if (res.error) {
      setErrorMessage(res.error.message ?? "Could not send verification email.");
      return;
    }
    setResent(true);
    toast.success("Verification link sent if the account exists");
  });

  return (
    <AuthCard
      eyebrow="Email Verification"
      title={status === "verified" ? "Email Verified" : "Verify Your Email"}
      description={
        status === "verified"
          ? "Your email address has been confirmed."
          : "Confirm your email address to protect your account and receive order dossiers."
      }
      footer={<AuthHelpLink href="/account">Go to My Account</AuthHelpLink>}
    >
      {status === "verifying" && (
        <p role="status" className="text-sm text-muted-foreground">
          Verifying your confirmation token...
        </p>
      )}

      {status === "verified" && (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-foreground"
          >
            Thank you. Your email is verified and your account is ready.
          </div>
          <Button asChild className="w-full">
            <Link href="/account">Continue to Account</Link>
          </Button>
        </div>
      )}

      {status !== "verifying" && status !== "verified" && (
        <div className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          {resent ? (
            <p role="status" className="text-sm text-foreground">
              Please check your inbox for a fresh verification link.
            </p>
          ) : (
            <form onSubmit={onResend} className="space-y-4" noValidate>
              <FormField
                id="verify-email-input"
                label="Email Address"
                required
                error={form.formState.errors.email?.message}
              >
                {(aria) => (
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="claire@example.com"
                    {...form.register("email")}
                    {...aria}
                  />
                )}
              </FormField>

              <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
                Resend Verification Link
              </Button>
            </form>
          )}
        </div>
      )}
    </AuthCard>
  );
}
