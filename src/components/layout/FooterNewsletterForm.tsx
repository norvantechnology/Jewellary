"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletterAction } from "@/modules/newsletter/newsletter.actions";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FooterNewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!SIMPLE_EMAIL_PATTERN.test(normalized) || normalized.length > 180) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailError(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    const result = await subscribeNewsletterAction({
      email: normalized,
      source: "footer",
      website,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      const msg = result.error.fieldErrors?.email?.[0] ?? result.error.message;
      setEmailError(msg);
      toast.error(result.error.message);
      return;
    }

    if (result.data.status === "already_subscribed") {
      setStatusMessage("You are already on our private atelier dispatch list.");
      toast.info("Already subscribed to atelier updates.");
      return;
    }

    setEmail("");
    setWebsite("");
    setStatusMessage("Welcome to the Maison list. You will receive seasonal collection previews.");
    toast.success("Subscribed to atelier previews.");
  }

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
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          aria-invalid={Boolean(emailError)}
          className="h-11 min-w-0 flex-1 bg-card"
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="sr-only"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Button type="submit" disabled={isSubmitting} className="shrink-0">
          {isSubmitting ? "Joining…" : "Subscribe"}
        </Button>
      </form>
      {emailError && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {emailError}
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
