"use client";

import * as React from "react";
import { useTheme } from "next-themes";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileFieldProps {
  siteKey: string | null;
  onToken: (token: string) => void;
}

const SCRIPT_ID = "cf-turnstile-script";

/**
 * Env-gated Cloudflare Turnstile widget using neutral light/dark stone palettes.
 */
export function TurnstileField({ siteKey, onToken }: TurnstileFieldProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenRef = React.useRef(onToken);

  React.useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const theme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";

  React.useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mountWidget);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", mountWidget);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  if (!siteKey) return null;

  return (
    <div className="rounded-sm border border-border bg-card/70 p-2.5">
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}
