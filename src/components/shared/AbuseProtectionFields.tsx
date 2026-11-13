"use client";

import * as React from "react";
import { TurnstileField } from "@/components/shared/TurnstileField";

interface AbuseProtectionFieldsProps {
  website: string;
  onWebsiteChange: (val: string) => void;
  turnstileSiteKey: string | null;
  onTurnstileToken: (token: string) => void;
}

/**
 * Shared honeypot field + optional Cloudflare Turnstile verification widget.
 */
export function AbuseProtectionFields({
  website,
  onWebsiteChange,
  turnstileSiteKey,
  onTurnstileToken,
}: AbuseProtectionFieldsProps) {
  const websiteId = React.useId();

  return (
    <>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={websiteId}>Leave this field empty</label>
        <input
          id={websiteId}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
        />
      </div>
      <TurnstileField siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
    </>
  );
}
