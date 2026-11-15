"use client";

import * as React from "react";

/**
 * Horizontal chip rows: on load, scrolls the current chip (aria-current="page") into view so the
 * selected option is never hidden off-screen on phones. Only scrolls the row, never the page.
 */
export function ScrollActiveIntoView({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
