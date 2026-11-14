"use client";
import { fill, fillNodes, useUiText } from "@/components/providers/UiTextProvider";

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

export function EnquiryForm({
  defaultType = "GENERAL",
  productId = null,
  productName = null,
  onSuccess,
}: EnquiryFormProps) {
  const ui = useUiText();
  const ENQUIRY_LABELS: Record<CreateEnquiryInput["type"], string> = ui.contactForm.topics;
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
      message: productName ? fill(ui.contactForm.productMessage, { product: productName }) : "",
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
    void notifySuccess(ui.contactForm.successToast);
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
            {ui.contactForm.successTitle}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {fillNodes(ui.contactForm.successText, {
              reference: (
                <span className="font-mono text-foreground">
                  {submittedRef.slice(-8).toUpperCase()}
                </span>
              ),
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => setSubmittedRef(null)}
          >
            {ui.contactForm.sendAnother}
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
          {ui.contactForm.regarding}{" "}
          <strong className="font-semibold text-foreground">{productName}</strong>
        </div>
      )}

      <FormField
        id="enquiry-type"
        label={ui.contactForm.topicLabel}
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
          label={ui.contactForm.nameLabel}
          required
          error={form.formState.errors.name?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              autoComplete="name"
              placeholder={ui.contactForm.namePlaceholder}
              {...form.register("name")}
            />
          )}
        </FormField>

        <FormField
          id="enquiry-email"
          label={ui.contactForm.emailLabel}
          required
          error={form.formState.errors.email?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={ui.contactForm.emailPlaceholder}
              {...form.register("email")}
            />
          )}
        </FormField>
      </div>

      <FormField
        id="enquiry-phone"
        label={ui.contactForm.phoneLabel}
        hint={ui.contactForm.phoneHint}
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
        label={ui.contactForm.messageLabel}
        required
        error={form.formState.errors.message?.message}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={4}
            placeholder={ui.contactForm.messagePlaceholder}
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
        {form.formState.isSubmitting ? ui.contactForm.submitting : ui.contactForm.submit}
      </Button>
    </form>
  );
}
