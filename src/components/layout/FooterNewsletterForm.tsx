"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletterAction } from "@/modules/newsletter/newsletter.actions";
import {
  subscribeNewsletterSchema,
  type SubscribeNewsletterInput,
} from "@/modules/newsletter/newsletter.schemas";

export function FooterNewsletterForm() {
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(subscribeNewsletterSchema),
    defaultValues: {
      email: "",
      source: "footer",
      website: "",
    },
  });

  const onSubmit = form.handleSubmit(async (rawValues) => {
    const values = rawValues as SubscribeNewsletterInput;
    setStatusMessage(null);
    const result = await subscribeNewsletterAction(values);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    if (result.data.status === "already_subscribed") {
      setStatusMessage("You are already on our private atelier dispatch list.");
      toast.info("Already subscribed to atelier updates.");
      return;
    }

    form.reset({ email: "", source: "footer", website: "" });
    setStatusMessage("Welcome to the Maison list. You will receive seasonal collection previews.");
    toast.success("Subscribed to atelier previews.");
  });

  return (
    <div className="mt-6 max-w-sm">
      <p className="mb-2 font-sans text-editorial-label text-foreground">Private Previews</p>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Receive occasional dispatches on newly graded stones, seasonal solitaires, and private salon
        appointments.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <label htmlFor="footer-newsletter-email" className="sr-only">
          Email address for newsletter
        </label>
        <Input
          id="footer-newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          className="h-11 min-w-0 flex-1 bg-card"
          {...form.register("email")}
        />
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="sr-only"
          {...form.register("website")}
        />
        <Button type="submit" disabled={form.formState.isSubmitting} className="shrink-0">
          {form.formState.isSubmitting ? "Joining…" : "Subscribe"}
        </Button>
      </form>
      {form.formState.errors.email?.message && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {form.formState.errors.email.message}
        </p>
      )}
      {statusMessage && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-text" role="status">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </p>
      )}
    </div>
  );
}
