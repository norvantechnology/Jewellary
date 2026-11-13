"use client";

import * as React from "react";

/**
 * Tracks the rendered site header height (including announcement bar) and mobile
 * scroll-hide state so sticky progress bars and summary panels sit cleanly below
 * the header without overlapping or jumping when the announcement is dismissed.
 */
export function useHeaderOffset(enabled = true) {
  const [headerHeight, setHeaderHeight] = React.useState(72);
  const [headerHidden, setHeaderHidden] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const header = document.querySelector<HTMLElement>('header[data-vt="header"]');
    if (!header) return;

    const syncHeight = () => {
      const rect = header.getBoundingClientRect();
      const next = Math.max(0, Math.round(rect.height));
      setHeaderHeight((prev) => (prev === next ? prev : next));
    };

    const syncHidden = () => {
      const hidden = header.getAttribute("data-hidden") === "true";
      setHeaderHidden((prev) => (prev === hidden ? prev : hidden));
    };

    syncHeight();
    syncHidden();

    const ro = new ResizeObserver(() => syncHeight());
    ro.observe(header);

    const mo = new MutationObserver(() => syncHidden());
    mo.observe(header, { attributes: true, attributeFilter: ["data-hidden"] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [enabled]);

  return {
    headerHeight,
    headerHidden,
    desktopStickyTop: headerHeight + 24,
    mobileStickyTop: headerHidden ? 0 : headerHeight,
  };
}
