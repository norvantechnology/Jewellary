"use client";

import * as React from "react";

/** Reports a real 404 view once, after the not-found page is actually on screen. */
export function NotFoundBeacon() {
  React.useEffect(() => {
    const payload = JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || null,
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/telemetry/not-found", blob)) {
      void fetch("/api/telemetry/not-found", {
        method: "POST",
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);
  return null;
}
