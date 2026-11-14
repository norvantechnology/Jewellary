"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { AlertCircle, Check, CheckCircle2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { AbuseProtectionFields } from "@/components/shared/AbuseProtectionFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAbuseProtection } from "@/hooks/use-abuse-protection";
import { MOTION_EASE, useReducedMotionSafe } from "@/lib/motion";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { subscribeNewsletterAction } from "@/modules/newsletter/newsletter.actions";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FooterNewsletterForm() {
  const t = useUiText().newsletterForm;
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [subscribedSuccess, setSubscribedSuccess] = React.useState(false);
  const formWrapRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionSafe();
  const abuse = useAbuseProtection({ deferMs: -1 });
  const activateAbuse = abuse.activate;

  React.useEffect(() => {
    const el = formWrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activateAbuse();
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activateAbuse]);

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
      website: abuse.website,
      timingToken: abuse.timingToken,
      turnstileToken: abuse.turnstileToken,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      const msg = result.error.fieldErrors?.email?.[0] ?? result.error.message;
      setEmailError(msg);
      void notifyError(result.error.message);
      abuse.refreshToken();
      return;
    }

    if (result.data.status === "already_subscribed") {
      setStatusMessage(t.alreadyStatus);
      void notifyInfo(t.alreadyToast);
      return;
    }

    setEmail("");
    abuse.refreshToken();
    setSubscribedSuccess(true);
    setStatusMessage(t.successStatus);
    void notifySuccess(t.successToast);
  }

  const buttonStateKey = isSubmitting ? "sending" : subscribedSuccess ? "subscribed" : "idle";

  return (
    <div ref={formWrapRef} className="mt-5 max-w-sm">
      <p className="mb-1 text-sm font-semibold text-footer-text">{t.heading}</p>
      <p className="mb-3 text-sm text-footer-muted">{t.text}</p>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="footer-newsletter-email" className="sr-only">
            {t.emailLabel}
          </label>
          <Input
            id="footer-newsletter-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.placeholder}
            value={email}
            onFocus={abuse.activate}
            onPointerEnter={abuse.activate}
            onChange={(e) => {
              abuse.activate();
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
              if (subscribedSuccess) setSubscribedSuccess(false);
            }}
            aria-invalid={Boolean(emailError)}
            className="h-12 min-w-0 flex-1 border-footer-border bg-footer-input-bg text-footer-text placeholder:text-footer-subtle focus-visible:border-footer-accent focus-visible:outline-footer-accent md:h-11"
          />
          <Button
            type="submit"
            variant="accent"
            disabled={isSubmitting}
            className="h-12 w-full shrink-0 px-5 sm:w-auto sm:min-w-[120px] md:h-11"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={buttonStateKey}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.18, ease: MOTION_EASE.out }}
                className="inline-flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  t.sending
                ) : subscribedSuccess ? (
                  <>
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                    <span>{t.subscribed}</span>
                  </>
                ) : (
                  t.submit
                )}
              </m.span>
            </AnimatePresence>
          </Button>
        </div>
        <AbuseProtectionFields
          website={abuse.website}
          onWebsiteChange={abuse.setWebsite}
          turnstileSiteKey={abuse.turnstileSiteKey}
          onTurnstileToken={abuse.setTurnstileToken}
        />
      </form>
      {emailError && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-footer-danger" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span>{emailError}</span>
        </p>
      )}
      {statusMessage && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-footer-accent" role="status">
          <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span>{statusMessage}</span>
        </p>
      )}
    </div>
  );
}
