"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONSENT_COOKIE_NAME } from "@/lib/constants";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  decidedAt: string;
}

export const CONSENT_EVENT = "maison:consent-updated";

export function readConsentCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.analytics === "boolean" && typeof parsed.decidedAt === "string") {
      return { necessary: true, analytics: parsed.analytics, decidedAt: parsed.decidedAt };
    }
  } catch {
    return null;
  }
  return null;
}

export function subscribeConsent(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  return () => window.removeEventListener(CONSENT_EVENT, callback);
}

function getConsentVisibilitySnapshot(): boolean {
  return readConsentCookie() === null;
}

function writeConsentCookie(state: ConsentState) {
  const maxAge = 60 * 60 * 24 * 180; // 180 days
  const encoded = encodeURIComponent(JSON.stringify(state));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function CookieBanner() {
  const pathname = usePathname();
  const visible = React.useSyncExternalStore(
    subscribeConsent,
    getConsentVisibilitySnapshot,
    () => false,
  );
  const [showPreferences, setShowPreferences] = React.useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(false);

  if (!visible || pathname?.startsWith("/admin")) return null;

  const saveConsent = (analytics: boolean) => {
    writeConsentCookie({
      necessary: true,
      analytics,
      decidedAt: new Date().toISOString(),
    });
  };

  return (
    <aside
      aria-label="Cookie preferences"
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md rounded-md border border-border bg-card p-4 shadow-soft sm:left-auto sm:w-full sm:max-w-sm"
    >
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-foreground">
            Privacy &amp; Cookie Preferences
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            We use strictly necessary cookies for your shopping bag, wishlist, and session security.
            Optional analytics cookies help us improve discovery and are activated only with your
            consent. Read our{" "}
            <Link href="/privacy" className="text-accent-text underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {showPreferences && (
          <div className="grid gap-3 rounded-sm border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Strictly Necessary</p>
                <p className="text-muted-foreground">Session, cart, wishlist, and theme state.</p>
              </div>
              <span className="font-medium text-accent-text">Always active</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2.5">
              <div>
                <p className="font-medium text-foreground">Analytics</p>
                <p className="text-muted-foreground">
                  Helps measure collection interest without ads.
                </p>
              </div>
              <Switch
                aria-label="Enable analytics cookies"
                checked={analyticsEnabled}
                onCheckedChange={setAnalyticsEnabled}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreferences((prev) => !prev)}
          >
            {showPreferences ? "Hide choices" : "Manage choices"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => saveConsent(false)}>
            Essential only
          </Button>
          {showPreferences ? (
            <Button type="button" size="sm" onClick={() => saveConsent(analyticsEnabled)}>
              Save preferences
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => saveConsent(true)}>
              Accept all
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
