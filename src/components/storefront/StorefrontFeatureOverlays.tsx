"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ATELIER_CUSTOMIZE_EVENT, hasPendingAtelierCustomization } from "@/lib/atelier-events";

const LazyCustomizationSheet = dynamic(
  () => import("@/components/storefront/CustomizationSheet").then((mod) => mod.CustomizationSheet),
  { ssr: false },
);

const LazyChatWidget = dynamic(
  () => import("@/components/storefront/ChatWidget").then((mod) => mod.ChatWidget),
  { ssr: false },
);

/**
 * Lazy-loaded interactive storefront overlays (customization drawer & concierge
 * realtime chat) mounted inside StorefrontShell so CurrencyProvider is available
 * without increasing initial route hydration cost.
 */
export function StorefrontFeatureOverlays() {
  const [customizerMounted, setCustomizerMounted] = React.useState(false);

  React.useEffect(() => {
    const onOpen = () => setCustomizerMounted(true);
    let cancelled = false;
    if (hasPendingAtelierCustomization()) {
      queueMicrotask(() => {
        if (!cancelled) setCustomizerMounted(true);
      });
    }
    window.addEventListener(ATELIER_CUSTOMIZE_EVENT, onOpen, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener(ATELIER_CUSTOMIZE_EVENT, onOpen);
    };
  }, []);

  return (
    <>
      {customizerMounted ? <LazyCustomizationSheet /> : null}
      <LazyChatWidget />
    </>
  );
}
