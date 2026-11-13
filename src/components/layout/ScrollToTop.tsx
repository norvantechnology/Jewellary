"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Every page opens at the top: on first load / refresh (browsers otherwise restore the old
 * position) and on each route change. Deep links with a #hash are left to the browser.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  React.useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  React.useLayoutEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
