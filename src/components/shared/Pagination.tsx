import { PaginationNav } from "@/components/shared/PaginationNav";

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

  const hrefs = Array.from({ length: totalPages + 1 }, (_, page) =>
    page === 0 ? "" : buildHref(page),
  );
  return (
    <PaginationNav
      currentPage={currentPage}
      totalPages={totalPages}
      pages={pages}
      hrefs={hrefs}
      className={className}
    />
  );
}
