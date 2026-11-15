"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CONSENT_COOKIE_NAME } from "@/lib/constants";
import { TOAST_ACTIVATE_EVENT } from "@/lib/notify";

const CookieBanner = dynamic(
  () => import("@/components/layout/CookieBanner").then((m) => m.CookieBanner),
  { ssr: false },
);

const Toaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), {
  ssr: false,
});

const ConsentAnalytics = dynamic(
  () => import("@/components/layout/ConsentAnalytics").then((m) => m.ConsentAnalytics),
  { ssr: false },
);

interface DeferredOverlaysProps {
  gaId?: string;
}

function parseConsentFromDocument(): { analytics: boolean } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(raw) as { analytics?: unknown; decidedAt?: unknown };
    if (typeof parsed.analytics === "boolean" && typeof parsed.decidedAt === "string") {
      return { analytics: parsed.analytics };
    }
  } catch {
    return null;
  }
  return null;
}

function subscribeConsentEvents(callback: () => void): () => void {
  window.addEventListener("shinora:consent-updated", callback);
  return () => window.removeEventListener("shinora:consent-updated", callback);
}

function getMissingConsentSnapshot(): boolean {
  return parseConsentFromDocument() === null;
}

function getAnalyticsAllowedSnapshot(): boolean {
  return parseConsentFromDocument()?.analytics === true;
}

export function DeferredOverlays({ gaId }: DeferredOverlaysProps) {
  const needsConsentBanner = React.useSyncExternalStore(
    subscribeConsentEvents,
    getMissingConsentSnapshot,
    () => false,
  );
  const analyticsAllowed = React.useSyncExternalStore(
    subscribeConsentEvents,
    getAnalyticsAllowedSnapshot,
    () => false,
  );
  const [cookieSettingsOpened, setCookieSettingsOpened] = React.useState(false);
  const [mountToaster, setMountToaster] = React.useState(false);

  React.useEffect(() => {
    const onOpenSettings = () => setCookieSettingsOpened(true);
    const onToastActivate = () => setMountToaster(true);

    window.addEventListener("ma:open-cookie-settings", onOpenSettings);
    window.addEventListener(TOAST_ACTIVATE_EVENT, onToastActivate, { once: true });

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idleId = hasIdle
      ? window.requestIdleCallback(() => setMountToaster(true), { timeout: 6000 })
      : globalThis.setTimeout(() => setMountToaster(true), 6000);

    return () => {
      window.removeEventListener("ma:open-cookie-settings", onOpenSettings);
      window.removeEventListener(TOAST_ACTIVATE_EVENT, onToastActivate);
      if (hasIdle && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId as number);
      } else {
        globalThis.clearTimeout(idleId);
      }
    };
  }, []);

  return (
    <>
      {needsConsentBanner || cookieSettingsOpened ? (
        <CookieBanner initialForceOpen={cookieSettingsOpened} />
      ) : null}
      {mountToaster ? <Toaster /> : null}
      {analyticsAllowed && gaId ? <ConsentAnalytics gaId={gaId} /> : null}
    </>
  );
}
