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
import { authClient } from "@/server/auth-client";

interface LoginFormProps {
  nextUrl: string;
  googleEnabled: boolean;
}

export function LoginForm({ nextUrl, googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [googlePending, setGooglePending] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const res = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: nextUrl,
    });

    if (res.error) {
      setServerError(res.error.message ?? "Invalid email or password.");
      return;
    }

    toast.success("Signed in");
    router.push(nextUrl);
    router.refresh();
  });

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
          New to the maison?{" "}
          <AuthHelpLink href={`/register?next=${encodeURIComponent(nextUrl)}`}>
            Create an account
          </AuthHelpLink>
        </span>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

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
          <AuthHelpLink href="/forgot-password">Forgot password?</AuthHelpLink>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Sign In
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
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
