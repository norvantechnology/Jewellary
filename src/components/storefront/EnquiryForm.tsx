"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/shared/FormField";
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
    const result = await submitEnquiryAction(values);

    if (!result.ok) {
      setServerError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    setSubmittedRef(result.data.id);
    toast.success("Your concierge note has been received.");
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
      <div
        role="status"
        className="rounded-md border border-accent/40 bg-card p-6 text-center shadow-card"
      >
        <CheckCircle2 className="mx-auto size-8 text-accent" aria-hidden="true" />
        <h3 className="mt-3 font-display text-2xl font-medium text-foreground">
          Thank You for Reaching Out
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          A senior gemologist from our private concierge has received your enquiry (Reference:{" "}
          <span className="font-mono text-foreground">{submittedRef.slice(-8).toUpperCase()}</span>)
          and will respond within one business day.
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
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      {productName && (
        <div className="rounded-sm border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          Regarding creation: <strong className="text-foreground">{productName}</strong>
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

      <div className="grid gap-4 sm:grid-cols-2">
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

      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        className="sr-only"
        {...form.register("website")}
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
