import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}

export function Pagination({ currentPage, totalPages, buildHref, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          aria-label="Previous page"
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
          aria-label="Next page"
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
