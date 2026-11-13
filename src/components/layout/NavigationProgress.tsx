"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordRoute } from "@/lib/route-history";

/**
 * Thin top bar shown the moment an internal link is clicked, until the new route renders.
 * Gives instant feedback on every navigation, including pages that block on request data.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = React.useState(false);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [lastRouteKey, setLastRouteKey] = React.useState(routeKey);

  // Route changed: navigation finished.
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setActive(false);
  }

  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const current = window.location;
      if (url.pathname === current.pathname && url.search === current.search) return;
      setActive(true);
    }
    function onPopState() {
      setActive(true);
    }
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  React.useEffect(() => {
    recordRoute(routeKey);
  }, [routeKey]);

  // Safety net: never leave the bar stuck (e.g. a click that was cancelled by the page).
  React.useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(false), 10_000);
    return () => window.clearTimeout(id);
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      {active ? <div className="nav-progress-bar h-full bg-accent" /> : null}
    </div>
  );
}
