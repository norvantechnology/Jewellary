"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
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
    const res = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      phone,
      callbackURL: nextUrl,
    });

    if (res.error) {
      setServerError(res.error.message ?? "Unable to create your account. Please try again.");
      return;
    }

    await Promise.allSettled([syncGuestWishlistOnAuthAction(), syncGuestCartOnAuthAction()]);

    toast.success("Account created. Please check your inbox to verify your email.");
    router.push(nextUrl);
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
          className="rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
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
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="register-terms"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={Boolean(form.formState.errors.acceptTerms)}
                  className="mt-0.5"
                />
                <Label htmlFor="register-terms" className="text-xs leading-relaxed font-normal">
                  I agree to the <AuthHelpLink href="/terms">Terms of Service</AuthHelpLink> and{" "}
                  <AuthHelpLink href="/privacy">Privacy Policy</AuthHelpLink>.
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
