"use client";

import * as React from "react";

interface FormTokenResponse {
  token: string;
  turnstileSiteKey: string | null;
}

interface UseAbuseProtectionOptions {
  /** Delay non-focused token initialization (ms) so above-the-fold routes stay network-quiet at first paint. */
  deferMs?: number;
}

export function useAbuseProtection(options: UseAbuseProtectionOptions = {}) {
  const { deferMs = 0 } = options;
  const [timingToken, setTimingToken] = React.useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = React.useState<string | null>(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null,
  );
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [nonce, setNonce] = React.useState(0);
  const [readyToFetch, setReadyToFetch] = React.useState(deferMs === 0);

  const activate = React.useCallback(() => {
    setReadyToFetch(true);
  }, []);

  const refreshToken = React.useCallback(() => {
    setTurnstileToken("");
    setWebsite("");
    setReadyToFetch(true);
    setNonce((n) => n + 1);
  }, []);

  React.useEffect(() => {
    if (readyToFetch || deferMs <= 0) return;
    const timer = window.setTimeout(() => setReadyToFetch(true), deferMs);
    return () => window.clearTimeout(timer);
  }, [readyToFetch, deferMs]);

  React.useEffect(() => {
    if (!readyToFetch) return;
    let active = true;
    fetch("/api/security/form-token", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<FormTokenResponse>) : null))
      .then((data) => {
        if (!active || !data) return;
        setTimingToken(data.token);
        setTurnstileSiteKey(data.turnstileSiteKey);
      })
      .catch(() => {
        // Handled server-side if token could not be initialized
      });

    return () => {
      active = false;
    };
  }, [nonce, readyToFetch]);

  return {
    timingToken,
    website,
    setWebsite,
    turnstileToken,
    setTurnstileToken,
    turnstileSiteKey,
    refreshToken,
    activate,
  };
}
