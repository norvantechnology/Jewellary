"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { notifyError, notifySuccess } from "@/lib/notify";
import { FadeIn } from "@/components/motion/Reveal";
import { AbuseProtectionFields } from "@/components/shared/AbuseProtectionFields";
import { FormField } from "@/components/shared/FormField";
import { useAbuseProtection } from "@/hooks/use-abuse-protection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitEnquiryAction } from "@/modules/enquiries/enquiry.actions";
import { createEnquirySchema, type CreateEnquiryInput } from "@/modules/enquiries/enquiry.schemas";

interface EnquiryFormProps {
  defaultType?: "BESPOKE" | "PRODUCT" | "GENERAL";
  productId?: string | null;
  productName?: string | null;
  onSuccess?: () => void;
}

const ENQUIRY_LABELS: Record<CreateEnquiryInput["type"], string> = {
  BESPOKE: "Bespoke Commission / Custom Stone",
  PRODUCT: "Piece Specifications & Private Salon Viewing",
  GENERAL: "Client Care & Resizing Advice",
};

export function EnquiryForm({
  defaultType = "GENERAL",
  productId = null,
  productName = null,
  onSuccess,
}: EnquiryFormProps) {
  const [submittedRef, setSubmittedRef] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const abuse = useAbuseProtection();

  const form = useForm({
    resolver: zodResolver(createEnquirySchema),
    defaultValues: {
      type: defaultType,
      name: "",
      email: "",
      phone: "",
      message: productName ? `I would like further details regarding ${productName}.` : "",
      productId: productId ?? "",
      website: "",
    },
  });

  const onSubmit = form.handleSubmit(async (rawValues) => {
    const values = rawValues as CreateEnquiryInput;
    setServerError(null);
    const result = await submitEnquiryAction({
      ...values,
      website: abuse.website || values.website || "",
      timingToken: abuse.timingToken,
      turnstileToken: abuse.turnstileToken,
    });

    if (!result.ok) {
      setServerError(result.error.message);
      void notifyError(result.error.message);
      abuse.refreshToken();
      return;
    }

    setSubmittedRef(result.data.id);
    void notifySuccess("Your concierge note has been received.");
    abuse.refreshToken();
    form.reset({
      type: defaultType,
      name: "",
      email: "",
      phone: "",
      message: "",
      productId: productId ?? "",
      website: "",
    });
    onSuccess?.();
  });

  if (submittedRef) {
    return (
      <FadeIn>
        <div
          role="status"
          className="rounded-lg border border-accent/40 bg-card p-6 text-center shadow-card"
        >
          <span
            aria-hidden="true"
            className="mx-auto flex size-11 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M5 13l4 4L19 7" className="ma-check-draw" />
            </svg>
          </span>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.015em] text-foreground sm:text-2xl">
            Thank You for Reaching Out
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A senior gemologist from our private concierge has received your enquiry (Reference:{" "}
            <span className="font-mono text-foreground">
              {submittedRef.slice(-8).toUpperCase()}
            </span>
            ) and will respond within one business day.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => setSubmittedRef(null)}
          >
            Send Another Note
          </Button>
        </div>
      </FadeIn>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="ma-error-shake rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {productName && (
        <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-xs text-muted-foreground">
          Regarding creation:{" "}
          <strong className="font-semibold text-foreground">{productName}</strong>
        </div>
      )}

      <FormField
        id="enquiry-type"
        label="Enquiry Topic"
        required
        error={form.formState.errors.type?.message}
      >
        {(aria) => (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={aria.id} aria-describedby={aria["aria-describedby"]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENQUIRY_LABELS) as Array<CreateEnquiryInput["type"]>).map((key) => (
                    <SelectItem key={key} value={key}>
                      {ENQUIRY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <FormField
          id="enquiry-name"
          label="Full Name"
          required
          error={form.formState.errors.name?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              autoComplete="name"
              placeholder="Claire Beaumont"
              {...form.register("name")}
            />
          )}
        </FormField>

        <FormField
          id="enquiry-email"
          label="Email Address"
          required
          error={form.formState.errors.email?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register("email")}
            />
          )}
        </FormField>
      </div>

      <FormField
        id="enquiry-phone"
        label="Telephone (optional)"
        hint="Useful if you prefer a WhatsApp or studio voice consultation."
        error={form.formState.errors.phone?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 212 555 0140"
            {...form.register("phone")}
          />
        )}
      </FormField>

      <FormField
        id="enquiry-message"
        label="How Can We Assist?"
        required
        error={form.formState.errors.message?.message}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={4}
            placeholder="Share preferred ring size, stone preferences, or timeline..."
            {...form.register("message")}
          />
        )}
      </FormField>

      <AbuseProtectionFields
        website={abuse.website}
        onWebsiteChange={abuse.setWebsite}
        turnstileSiteKey={abuse.turnstileSiteKey}
        onTurnstileToken={abuse.setTurnstileToken}
      />

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Submitting…" : "Submit Concierge Enquiry"}
      </Button>
    </form>
  );
}
