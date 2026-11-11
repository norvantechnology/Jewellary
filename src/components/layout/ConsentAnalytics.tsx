"use client";

import * as React from "react";
import Script from "next/script";
import { readConsentCookie, subscribeConsent } from "@/components/layout/CookieBanner";

interface ConsentAnalyticsProps {
  gaId?: string;
}

function getAnalyticsSnapshot(): boolean {
  return readConsentCookie()?.analytics === true;
}

export function ConsentAnalytics({ gaId }: ConsentAnalyticsProps) {
  const allowed = React.useSyncExternalStore(subscribeConsent, getAnalyticsSnapshot, () => false);

  if (!gaId || !allowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
