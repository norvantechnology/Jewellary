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
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          aria-label="Previous page"
          className="inline-flex size-11 items-center justify-center rounded-sm border border-border bg-card text-foreground transition-colors hover:border-accent hover:bg-muted"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex size-11 items-center justify-center rounded-sm border border-border bg-muted/40 text-muted-foreground opacity-50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </span>
      )}

      {pages.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-sm border text-sm font-medium tabular-nums-price transition-colors",
              item === currentPage
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-accent hover:bg-muted",
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
          className="inline-flex size-11 items-center justify-center rounded-sm border border-border bg-card text-foreground transition-colors hover:border-accent hover:bg-muted"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex size-11 items-center justify-center rounded-sm border border-border bg-muted/40 text-muted-foreground opacity-50"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
