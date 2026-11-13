"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { m } from "motion/react";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { buildNavigationSections } from "@/components/layout/navigation-data";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Logo } from "@/components/shared/Logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { menuContainerVariants, menuItemVariants, useReducedMotionSafe } from "@/lib/motion";
import type { NavCategoryItem } from "@/types/navigation";

export function MobileNavSheet({
  siteName,
  categories,
  open,
  onOpenChange,
}: {
  siteName: string;
  categories: NavCategoryItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const resolvedOpen = open ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange],
  );
  const pathname = usePathname();
  const prevPathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setOpen(false);
    }
  }, [pathname, setOpen]);
  const { categoryGroups, collections } = React.useMemo(
    () => buildNavigationSections(categories),
    [categories],
  );
  const reducedMotion = useReducedMotionSafe();

  return (
    <Sheet open={resolvedOpen} onOpenChange={setOpen}>
      {open === undefined && (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open navigation menu"
            className="transition-ui inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-text-2 hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          >
            <Menu className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </SheetTrigger>
      )}

      <SheetContent
        side="left"
        className="flex h-dvh w-[min(86vw,360px)] max-w-[360px] flex-col gap-0 p-0 sm:max-w-[360px]"
      >
        <div className="safe-area-pt flex h-14 shrink-0 items-center justify-between border-b border-border pr-14 pl-5 md:h-16">
          <SheetTitle className="min-w-0 font-display text-base font-semibold tracking-tight">
            <Logo siteName={siteName} onClick={() => setOpen(false)} />
          </SheetTitle>
        </div>

        <nav aria-label="Mobile Navigation" className="flex-1 overflow-y-auto px-5 py-2">
          <m.div
            variants={reducedMotion ? undefined : menuContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <m.div variants={reducedMotion ? undefined : menuItemVariants}>
              <Link
                href="/collections"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-text hover:text-accent-text"
              >
                All Jewellery
              </Link>
            </m.div>

            <Accordion type="multiple" defaultValue={["categories"]} className="w-full">
              <AccordionItem value="categories" className="border-b border-border">
                <AccordionTrigger className="min-h-12 py-3 text-sm font-medium hover:no-underline">
                  Shop by Category
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-3">
                  {categoryGroups.map((group) => (
                    <div key={group.id}>
                      <Link
                        href={group.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center text-sm font-semibold text-text"
                      >
                        {group.title}
                      </Link>
                      <ul className="border-l border-border pl-3">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="flex min-h-12 items-center text-sm text-text-2 hover:text-text"
                            >
                              {item.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="collections" className="border-b border-border">
                <AccordionTrigger className="min-h-12 py-3 text-sm font-medium hover:no-underline">
                  Collections
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="flex flex-col">
                    {collections.map((item) => (
                      <li key={item.id} className="min-w-0">
                        <Link
                          href={item.href}
                          title={item.title}
                          onClick={() => setOpen(false)}
                          className="flex min-h-12 max-w-full min-w-0 items-center text-sm text-text-2 hover:text-text"
                        >
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        href="/collections"
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center text-sm font-medium text-accent-text"
                      >
                        View all collections
                      </Link>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <m.div variants={reducedMotion ? undefined : menuItemVariants}>
              <Link
                href="/guides"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-text hover:text-accent-text"
              >
                Guides
              </Link>
            </m.div>
            <m.div variants={reducedMotion ? undefined : menuItemVariants}>
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-text hover:text-accent-text"
              >
                About Us
              </Link>
            </m.div>
            <m.div variants={reducedMotion ? undefined : menuItemVariants}>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-text hover:text-accent-text"
              >
                Contact
              </Link>
            </m.div>
          </m.div>
        </nav>

        <div className="shrink-0 space-y-3 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <CurrencySwitcher inDrawer />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-text"
            >
              Account
            </Link>
            <Link
              href="/account/orders"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-text"
            >
              Orders
            </Link>
            <Link
              href="/orders/track"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-text"
            >
              Track Order
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center text-sm text-text-2 hover:text-text"
            >
              Wishlist
            </Link>
          </div>
          <ThemeSwitcher inline />
        </div>
      </SheetContent>
    </Sheet>
  );
}
