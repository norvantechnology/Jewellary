"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CONSENT_COOKIE_NAME } from "@/lib/constants";
import { fadeInVariants, MOTION_SPRING, useReducedMotionSafe } from "@/lib/motion";

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
  const maxAge = 60 * 60 * 24 * 180;
  const encoded = encodeURIComponent(JSON.stringify(state));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export function CookieBanner({ initialForceOpen = false }: { initialForceOpen?: boolean } = {}) {
  const t = useUiText().cookies;
  const pathname = usePathname();
  const missingCookie = React.useSyncExternalStore(
    subscribeConsent,
    getConsentVisibilitySnapshot,
    () => false,
  );
  const [forcedOpen, setForcedOpen] = React.useState(initialForceOpen);
  const [showPreferences, setShowPreferences] = React.useState(initialForceOpen);
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(() =>
    initialForceOpen ? readConsentCookie()?.analytics === true : false,
  );
  const reducedMotion = useReducedMotionSafe();

  React.useEffect(() => {
    const handleOpen = () => {
      const existing = readConsentCookie();
      setAnalyticsEnabled(existing?.analytics === true);
      setShowPreferences(true);
      setForcedOpen(true);
    };
    window.addEventListener("ma:open-cookie-settings", handleOpen);
    return () => window.removeEventListener("ma:open-cookie-settings", handleOpen);
  }, []);

  const visible = (missingCookie || forcedOpen) && !pathname?.startsWith("/admin");

  // Hide floating launchers (chat) while the banner occupies the bottom of the viewport.
  React.useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.cookieBanner = "open";
    else delete root.dataset.cookieBanner;
    return () => {
      delete root.dataset.cookieBanner;
    };
  }, [visible]);

  const saveConsent = (analytics: boolean) => {
    writeConsentCookie({
      necessary: true,
      analytics,
      decidedAt: new Date().toISOString(),
    });
    setForcedOpen(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <m.aside
          key="cookie-banner"
          aria-label={t.bannerLabel}
          data-print-hidden="true"
          variants={reducedMotion ? fadeInVariants : undefined}
          initial={reducedMotion ? false : { opacity: 1, y: 12 }}
          animate={reducedMotion ? "visible" : { opacity: 1, y: 0 }}
          exit={reducedMotion ? "exit" : { opacity: 0, y: 12 }}
          transition={reducedMotion ? undefined : MOTION_SPRING.snappy}
          className="fixed inset-x-0 bottom-[var(--sticky-cta-offset,0px)] z-[var(--z-drawer)] border-t border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-text shadow-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-md sm:rounded-xl sm:border sm:p-4"
        >
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-text-2">
              {t.message}{" "}
              <button
                type="button"
                onClick={() => setShowPreferences((prev) => !prev)}
                className="inline-flex min-h-6 items-center font-medium text-text underline underline-offset-4 hover:text-accent-text"
              >
                {showPreferences ? t.hideChoices : t.manage}
              </button>
              {" · "}
              <Link
                href="/privacy"
                className="text-text underline underline-offset-4 hover:text-accent-text"
              >
                {t.privacy}
              </Link>
            </p>

            {showPreferences && (
              <div className="space-y-2.5 rounded-md border border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-text">{t.necessaryTitle}</p>
                    <p className="text-text-muted">{t.necessaryText}</p>
                  </div>
                  <span className="font-medium text-accent-text">{t.alwaysActive}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border pt-2.5">
                  <div>
                    <p className="font-medium text-text">{t.analyticsTitle}</p>
                    <p className="text-text-muted">{t.analyticsText}</p>
                  </div>
                  <Switch
                    aria-label={t.analyticsToggle}
                    checked={analyticsEnabled}
                    onCheckedChange={setAnalyticsEnabled}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => saveConsent(false)}
              >
                {t.essentialOnly}
              </Button>
              {showPreferences ? (
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => saveConsent(analyticsEnabled)}
                >
                  {t.saveChoices}
                </Button>
              ) : (
                <Button type="button" className="min-h-11" onClick={() => saveConsent(true)}>
                  {t.acceptAll}
                </Button>
              )}
            </div>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
