"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContactUiChoice } from "@/components/storefront/customize/types";
import { cn } from "@/lib/utils";

interface CustomizeDetailsStepProps {
  baseUid: string;
  mode: "create" | "edit";
  variant: "page" | "drawer";
  signedInUser: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  contactUiChoice: ContactUiChoice;
  preferredTimeline: string;
  preferredDate: string;
  customerNote: string;
  otpSentTo: string | null;
  otpCode: string;
  otpVerifiedEmail: string | null;
  sendingOtp: boolean;
  verifyingOtp: boolean;
  fieldErrors: Record<string, string>;
  onCustomerNameChange: (val: string) => void;
  onCustomerEmailChange: (val: string) => void;
  onCustomerPhoneChange: (val: string) => void;
  onContactUiChoiceChange: (choice: ContactUiChoice) => void;
  onPreferredTimelineChange: (val: string) => void;
  onPreferredDateChange: (val: string) => void;
  onCustomerNoteChange: (val: string) => void;
  onOtpCodeChange: (val: string) => void;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
}

const CONTACT_CHOICES: Array<{ value: ContactUiChoice; label: string }> = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "CHAT", label: "Chat" },
];

export function CustomizeDetailsStep({
  baseUid,
  mode,
  variant,
  signedInUser,
  customerName,
  customerEmail,
  customerPhone,
  contactUiChoice,
  preferredTimeline,
  preferredDate,
  customerNote,
  otpSentTo,
  otpCode,
  otpVerifiedEmail,
  sendingOtp,
  verifyingOtp,
  fieldErrors,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
  onContactUiChoiceChange,
  onPreferredTimelineChange,
  onPreferredDateChange,
  onCustomerNoteChange,
  onOtpCodeChange,
  onSendOtp,
  onVerifyOtp,
}: CustomizeDetailsStepProps) {
  const [changingIdentity, setChangingIdentity] = React.useState(false);
  const [showMoreDetails, setShowMoreDetails] = React.useState(
    Boolean(preferredTimeline.trim() || preferredDate.trim() || customerNote.trim()),
  );
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = noteRef.current;
    if (!el || !showMoreDetails) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(240, Math.max(88, el.scrollHeight))}px`;
  }, [customerNote, showMoreDetails]);

  const hasIdentityError = Boolean(fieldErrors.customerName || fieldErrors.customerEmail);
  const canShowCompactIdentity =
    (mode === "edit" || (signedInUser && !changingIdentity && !hasIdentityError)) &&
    Boolean(customerName.trim()) &&
    Boolean(customerEmail.trim());

  const cleanEmail = customerEmail.trim().toLowerCase();
  const isEmailOtpVerified = Boolean(otpVerifiedEmail && otpVerifiedEmail === cleanEmail);

  const nameId = `${baseUid}-customerName`;
  const emailId = `${baseUid}-customerEmail`;
  const phoneId = `${baseUid}-customerPhone`;
  const occasionId = `${baseUid}-preferredTimeline`;
  const dateId = `${baseUid}-preferredDate`;
  const noteId = `${baseUid}-customerNote`;

  return (
    <section
      aria-labelledby={`${baseUid}-details-heading`}
      className={cn("space-y-5", variant === "page" && "border-t border-border/80 pt-6")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={`${baseUid}-details-heading`}
          className="text-base leading-6 font-semibold text-foreground"
        >
          Your details
        </h2>
        <span className="text-xs text-muted-foreground">Required for quote delivery</span>
      </div>

      {/* Identity: Compact single row for signed-in users, or inputs */}
      {canShowCompactIdentity ? (
        <div
          data-testid="sending-as-row"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-3.5 py-3"
        >
          <p className="min-w-0 truncate text-sm text-foreground">
            <span className="text-muted-foreground">Sending as </span>
            <span className="font-medium">{customerName}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-muted-foreground">{customerEmail}</span>
          </p>
          {mode === "create" ? (
            <button
              type="button"
              onClick={() => setChangingIdentity(true)}
              className="min-h-8 shrink-0 rounded px-1.5 text-[13px] font-medium text-accent-text underline underline-offset-4 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Change
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {mode === "create" && signedInUser ? (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                Contact details for this request
              </span>
              {customerName.trim() && customerEmail.trim() && !hasIdentityError ? (
                <button
                  type="button"
                  onClick={() => setChangingIdentity(false)}
                  className="text-[13px] font-medium text-accent-text underline underline-offset-4 hover:opacity-80"
                >
                  Use signed-in account
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={nameId} className="block text-sm font-medium text-foreground">
                Full name
              </label>
              <Input
                id={nameId}
                autoComplete="name"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="Evelyn Sinclair"
                aria-invalid={Boolean(fieldErrors.customerName) || undefined}
                aria-describedby={fieldErrors.customerName ? `${nameId}-error` : undefined}
                className={cn(
                  "h-12 rounded-xl text-base",
                  fieldErrors.customerName && "border-destructive",
                )}
              />
              {fieldErrors.customerName ? (
                <p
                  id={`${nameId}-error`}
                  role="alert"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"
                >
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.customerName}</span>
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor={emailId} className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id={emailId}
                type="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(e) => onCustomerEmailChange(e.target.value)}
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.customerEmail) || undefined}
                aria-describedby={fieldErrors.customerEmail ? `${emailId}-error` : undefined}
                className={cn(
                  "h-12 rounded-xl text-base",
                  fieldErrors.customerEmail && "border-destructive",
                )}
              />
              {fieldErrors.customerEmail ? (
                <p
                  id={`${emailId}-error`}
                  role="alert"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"
                >
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.customerEmail}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Guest email OTP verification (optional / instant verification) */}
          {mode === "create" && !signedInUser && customerEmail.trim().length > 0 ? (
            <div className="rounded-lg border border-border bg-surface-2/50 p-3">
              {isEmailOtpVerified ? (
                <p className="flex items-center gap-2 text-xs font-medium text-success">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Email verified for instant bespoke quote tracking.</span>
                </p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MailCheck
                        className="size-3.5 shrink-0 text-accent-text"
                        aria-hidden="true"
                      />
                      <span>
                        {otpSentTo
                          ? `Code sent to ${otpSentTo}`
                          : "Verify email now to speed up atelier review"}
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sendingOtp}
                      onClick={onSendOtp}
                      className="h-8 text-xs"
                    >
                      {sendingOtp ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      <span>{otpSentTo ? "Resend code" : "Send code"}</span>
                    </Button>
                  </div>

                  {otpSentTo ? (
                    <div className="flex items-center gap-2">
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => onOtpCodeChange(e.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit code"
                        aria-label="Email verification code"
                        className="h-10 max-w-[160px] text-center tracking-widest tabular-nums"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={verifyingOtp || otpCode.trim().length !== 6}
                        onClick={onVerifyOtp}
                        className="h-10"
                      >
                        {verifyingOtp ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        <span>Verify</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Preferred contact segmented control */}
      <div className="space-y-2">
        <span
          id={`${baseUid}-contact-pref-label`}
          className="block text-sm font-medium text-foreground"
        >
          Preferred contact
        </span>
        <div
          role="radiogroup"
          aria-labelledby={`${baseUid}-contact-pref-label`}
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 p-1"
        >
          {CONTACT_CHOICES.map((choice) => {
            const active = contactUiChoice === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`contact-pref-${choice.value.toLowerCase()}`}
                onClick={() => onContactUiChoiceChange(choice.value)}
                className={cn(
                  "transition-ui min-h-10 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phone input: shown ONLY when Phone is selected */}
      {contactUiChoice === "PHONE" ? (
        <div className="space-y-1.5">
          <label htmlFor={phoneId} className="block text-sm font-medium text-foreground">
            Phone number
          </label>
          <Input
            id={phoneId}
            type="tel"
            autoComplete="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="+1 (555) 234-5678"
            aria-invalid={Boolean(fieldErrors.customerPhone) || undefined}
            aria-describedby={fieldErrors.customerPhone ? `${phoneId}-error` : undefined}
            className={cn(
              "h-12 rounded-xl text-base",
              fieldErrors.customerPhone && "border-destructive",
            )}
          />
          {fieldErrors.customerPhone ? (
            <p
              id={`${phoneId}-error`}
              role="alert"
              className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{fieldErrors.customerPhone}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Collapsed "Add more details (optional)" disclosure */}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          aria-expanded={showMoreDetails}
          aria-controls={`${baseUid}-more-details`}
          data-testid="more-details-toggle"
          onClick={() => setShowMoreDetails((prev) => !prev)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 text-left text-sm font-medium text-foreground hover:text-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span>Add more details (optional)</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              showMoreDetails && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        {showMoreDetails ? (
          <div id={`${baseUid}-more-details`} className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={occasionId} className="block text-sm font-medium text-foreground">
                  Occasion or timeline
                </label>
                <Input
                  id={occasionId}
                  value={preferredTimeline}
                  onChange={(e) => onPreferredTimelineChange(e.target.value)}
                  placeholder="e.g. Proposal in December"
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={dateId} className="block text-sm font-medium text-foreground">
                  Target wear date
                </label>
                <Input
                  id={dateId}
                  type="date"
                  value={preferredDate}
                  onChange={(e) => onPreferredDateChange(e.target.value)}
                  className="h-12 rounded-xl text-base [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={noteId} className="block text-sm font-medium text-foreground">
                  Atelier notes
                </label>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {customerNote.length}/1000
                </span>
              </div>
              <Textarea
                ref={noteRef}
                id={noteId}
                rows={3}
                maxLength={1000}
                value={customerNote}
                onChange={(e) => onCustomerNoteChange(e.target.value)}
                placeholder="Share diamond preferences, heirloom inspiration, or sizing details..."
                className="min-h-[96px] resize-none rounded-xl text-base"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
