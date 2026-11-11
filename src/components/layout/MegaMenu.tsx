"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavCategoryItem } from "@/types/navigation";

interface MegaMenuProps {
  categories: NavCategoryItem[];
}

export function MegaMenu({ categories }: MegaMenuProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const closeTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCategory = (id: string) => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpenId(id);
  };

  const scheduleClose = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    closeTimeout.current = setTimeout(() => setOpenId(null), 150);
  };

  React.useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  return (
    <nav aria-label="Primary collections" className="hidden lg:flex lg:items-center lg:gap-1">
      {categories.map((category) => {
        const hasChildren = category.children.length > 0;
        const isOpen = openId === category.id;

        return (
          <div
            key={category.id}
            className="relative"
            onMouseEnter={() => hasChildren && openCategory(category.id)}
            onMouseLeave={scheduleClose}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpenId(null);
            }}
          >
            <div className="flex items-center">
              <Link
                href={`/collections/${category.path}`}
                className="inline-flex min-h-11 items-center gap-1 px-3 text-sm font-medium tracking-wide text-foreground transition-colors hover:text-accent-text"
              >
                {category.name}
              </Link>
              {hasChildren && (
                <button
                  type="button"
                  aria-label={`Toggle ${category.name} submenu`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : category.id)}
                  className="-ml-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {hasChildren && isOpen && (
              <div
                role="region"
                aria-label={`${category.name} categories`}
                className="absolute top-full left-0 z-40 mt-1 w-72 rounded-md border border-border bg-card p-5 shadow-soft"
              >
                <p className="mb-3 text-editorial-label text-accent-text">{category.name}</p>
                <ul className="grid gap-1.5">
                  {category.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/collections/${sub.path}`}
                        onClick={() => setOpenId(null)}
                        className="block rounded-sm px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted hover:text-accent-text"
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-border pt-3">
                  <Link
                    href={`/collections/${category.path}`}
                    onClick={() => setOpenId(null)}
                    className="text-xs font-medium tracking-wider text-accent-text uppercase underline-offset-4 hover:underline"
                  >
                    Explore all {category.name}
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Link
        href="/collections"
        className="inline-flex min-h-11 items-center px-3 text-sm font-medium tracking-wide text-foreground transition-colors hover:text-accent-text"
      >
        All Jewellery
      </Link>
      <Link
        href="/guides"
        className="inline-flex min-h-11 items-center px-3 text-sm font-medium tracking-wide text-foreground transition-colors hover:text-accent-text"
      >
        Journal &amp; Guides
      </Link>
    </nav>
  );
}
