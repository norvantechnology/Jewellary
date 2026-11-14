"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUiText } from "@/components/providers/UiTextProvider";
import { cn } from "@/lib/utils";

/** Client half of <Pagination>: labels come from site-content.json → ui.common. */
export function PaginationNav({
  currentPage,
  totalPages,
  pages,
  hrefs,
  className,
}: {
  currentPage: number;
  totalPages: number;
  pages: (number | "ellipsis")[];
  /** hrefs[n] = link for page n (index 0 unused). */
  hrefs: string[];
  className?: string;
}) {
  const ui = useUiText();
  const buildHref = (page: number) => hrefs[page] ?? "#";
  return (
    <nav
      aria-label={ui.common.paginationLabel}
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          aria-label={ui.common.previousPage}
          className="transition-ui inline-flex size-11 items-center justify-center rounded-md border border-border-strong bg-surface text-text hover:border-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface-2 text-text-muted opacity-50"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}

      {pages.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="hidden px-1.5 text-sm text-text-muted sm:inline-block"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={cn(
              "tabular-nums-price transition-ui size-11 items-center justify-center rounded-md border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              item === currentPage
                ? "inline-flex border-primary bg-primary text-on-primary"
                : item === 1 || item === totalPages
                  ? "inline-flex border-border-strong bg-surface text-text hover:border-accent hover:bg-surface-2"
                  : "hidden border-border-strong bg-surface text-text hover:border-accent hover:bg-surface-2 sm:inline-flex",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          rel="next"
          aria-label={ui.common.nextPage}
          className="transition-ui inline-flex size-11 items-center justify-center rounded-md border border-border-strong bg-surface text-text hover:border-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface-2 text-text-muted opacity-50"
        >
          <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
