"use client";

import * as React from "react";
import { useFlipIndicator, useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface EditorialTocEntry {
  id: string;
  text: string;
}

interface EditorialTocProps {
  entries: EditorialTocEntry[];
}

/**
 * Sticky table-of-contents navigation with an IntersectionObserver active heading tracker
 * and a GPU FLIP-animated left indicator bar.
 */
export function EditorialToc({ entries }: EditorialTocProps) {
  const reducedMotion = useReducedMotionSafe();
  const [activeId, setActiveId] = React.useState<string | null>(entries[0]?.id ?? null);
  const listRef = React.useRef<HTMLUListElement>(null);

  useFlipIndicator(listRef, activeId, reducedMotion);

  React.useEffect(() => {
    if (entries.length === 0 || typeof IntersectionObserver === "undefined") return;

    const elements = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visibleMap = new Map<string, number>();

    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const item of observerEntries) {
          if (item.isIntersecting) {
            visibleMap.set(item.target.id, item.boundingClientRect.top);
          } else {
            visibleMap.delete(item.target.id);
          }
        }

        if (visibleMap.size > 0) {
          let topId: string | null = null;
          let minTop = Infinity;
          for (const [id, top] of visibleMap.entries()) {
            if (Math.abs(top) < minTop) {
              minTop = Math.abs(top);
              topId = id;
            }
          }
          if (topId) setActiveId(topId);
          return;
        }

        // Fallback to last heading scrolled past upper threshold
        let passedId: string | null = null;
        for (const el of elements) {
          if (el.getBoundingClientRect().top <= 160) {
            passedId = el.id;
          }
        }
        if (passedId) setActiveId(passedId);
      },
      { rootMargin: "-16% 0px -65% 0px", threshold: [0, 0.25, 1] },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav className="mt-3 border-l border-border pl-3.5">
      <ul ref={listRef} className="space-y-2 text-sm">
        {entries.map((entry) => {
          const isActive = activeId === entry.id;
          return (
            <li key={entry.id} className="relative">
              {isActive ? (
                <span
                  data-ma-indicator="true"
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0.5 bottom-0.5 -left-[15px] w-0.5 rounded-full bg-accent"
                />
              ) : null}
              <a
                href={`#${entry.id}`}
                onClick={() => setActiveId(entry.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block leading-snug transition-colors duration-150 ease-out focus-visible:underline focus-visible:outline-none",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
