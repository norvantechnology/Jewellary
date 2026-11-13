import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** On phones, show only a single "‹ Parent" link instead of the full trail. */
  compactOnMobile?: boolean;
}

export function Breadcrumbs({ items, className, compactOnMobile = false }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  const parent = compactOnMobile
    ? [...items.slice(0, -1)].reverse().find((item) => item.href)
    : undefined;

  return (
    <>
      {parent?.href && (
        <Link
          href={parent.href}
          className={cn(
            "inline-flex min-h-11 max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:hidden",
            className,
          )}
        >
          <ChevronLeft className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{parent.label}</span>
        </Link>
      )}
      <nav
        aria-label="Breadcrumb"
        className={cn(
          "py-1 text-xs text-muted-foreground sm:py-3 sm:text-sm",
          parent?.href && "hidden sm:block",
          className,
        )}
      >
        <ol className="-mx-1 flex scrollbar-none items-center gap-1.5 overflow-x-auto px-1 whitespace-nowrap sm:flex-wrap sm:overflow-visible">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li
                key={`${item.label}-${idx}`}
                className="inline-flex shrink-0 items-center gap-1.5"
              >
                {idx > 0 && (
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                )}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    title={item.label}
                    className="transition-ui inline-flex min-h-9 max-w-[12rem] items-center truncate rounded-sm underline-offset-4 hover:text-foreground hover:underline sm:min-h-8 sm:max-w-[18rem]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    title={item.label}
                    className="max-w-[14rem] truncate font-medium text-foreground sm:max-w-xs"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
