"use client";

import type { SiteContent } from "@/modules/site-content/site-content.shared";

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
import { useUiText } from "@/components/providers/UiTextProvider";

interface VerifyEmailPanelProps {
  token: string | null;
  /** Card text from site-content.json → pages.auth.verifyEmail.card. */
  copy: SiteContent["pages"]["auth"]["verifyEmail"]["card"];
}

export function VerifyEmailPanel({ token, copy }: VerifyEmailPanelProps) {
  const t = useUiText().auth.verifyEmail;
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
        setErrorMessage(res.error.message ?? t.invalidLinkError);
      } else {
        setStatus("verified");
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [token, t.invalidLinkError]);

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
      setErrorMessage(res.error.message ?? t.sendError);
      return;
    }
    setResent(true);
    toast.success(t.sentToast);
  });

  return (
    <AuthCard
      eyebrow={copy.eyebrow}
      title={status === "verified" ? copy.verifiedTitle : copy.title}
      description={status === "verified" ? copy.verifiedDescription : copy.description}
      footer={<AuthHelpLink href="/account">{t.goToAccount}</AuthHelpLink>}
    >
      {status === "verifying" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t.verifying}
        </p>
      )}

      {status === "verified" && (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-foreground"
          >
            {t.verifiedText}
          </div>
          <Button asChild className="w-full">
            <Link href="/account">{t.continueToAccount}</Link>
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
              {t.resentText}
            </p>
          ) : (
            <form onSubmit={onResend} className="space-y-4" noValidate>
              <FormField
                id="verify-email-input"
                label={t.emailLabel}
                required
                error={form.formState.errors.email?.message}
              >
                {(aria) => (
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t.emailPlaceholder}
                    {...form.register("email")}
                    {...aria}
                  />
                )}
              </FormField>

              <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
                {t.submit}
              </Button>
            </form>
          )}
        </div>
      )}
    </AuthCard>
  );
}
