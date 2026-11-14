"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import {
  MOTION_TRANSITIONS,
  fadeInVariants,
  menuContainerVariants,
  menuItemVariants,
} from "@/lib/motion";
import type {
  NavCategoryGroup,
  NavCollectionLink,
  NavLabels,
} from "@/components/layout/navigation-data";

export interface MegaMenuPortalProps {
  open: boolean;
  panelTop: number;
  panelId: string;
  panelRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  categoryGroups: NavCategoryGroup[];
  collections: NavCollectionLink[];
  labels: NavLabels;
  closeMenu: (restoreFocus?: boolean) => void;
  handleMouseEnterZone: () => void;
  handleMouseLeaveZone: () => void;
  handlePanelKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function MegaMenuPortal({
  open,
  panelTop,
  panelId,
  panelRef,
  reducedMotion,
  categoryGroups,
  collections,
  labels,
  closeMenu,
  handleMouseEnterZone,
  handleMouseLeaveZone,
  handlePanelKeyDown,
}: MegaMenuPortalProps) {
  const ui = useUiText();
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="mega-backdrop"
            aria-hidden="true"
            variants={fadeInVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reducedMotion ? MOTION_TRANSITIONS.reduced : MOTION_TRANSITIONS.fast}
            onClick={() => closeMenu(false)}
            style={{ top: `${panelTop}px` }}
            className="fixed inset-x-0 bottom-0 z-[var(--z-dropdown)] bg-overlay backdrop-blur-[1px]"
          />
          <div
            key="mega-wrapper"
            style={{ top: `${panelTop}px` }}
            className="pointer-events-none fixed inset-x-0 z-[var(--z-dropdown)] px-4 pt-2"
          >
            <m.div
              ref={panelRef}
              id={panelId}
              role="region"
              aria-label={ui.layout.megaMenuLabel}
              variants={reducedMotion ? fadeInVariants : menuContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onMouseEnter={handleMouseEnterZone}
              onMouseLeave={handleMouseLeaveZone}
              onKeyDown={handlePanelKeyDown}
              className="pointer-events-auto mx-auto w-full max-w-[880px] rounded-lg border border-border bg-surface p-6 text-text shadow-md"
            >
              <div className="grid grid-cols-4 gap-8">
                <div className="col-span-3">
                  <p className="mb-4 text-xs font-medium tracking-wider text-text-muted uppercase">
                    {labels.shopByCategory}
                  </p>
                  <div className="grid grid-cols-4 items-start gap-6">
                    {categoryGroups.map((group) => (
                      <m.div
                        key={group.id}
                        variants={reducedMotion ? undefined : menuItemVariants}
                        className="min-w-0"
                      >
                        <Link
                          href={group.href}
                          onClick={() => closeMenu(false)}
                          className="ma-link-underline inline-block text-sm font-semibold text-text hover:text-accent-text focus-visible:outline-none"
                        >
                          {group.title}
                        </Link>
                        <ul className="mt-2.5 flex flex-col gap-2">
                          {group.items.map((item) => (
                            <li key={item.id}>
                              <Link
                                href={item.href}
                                onClick={() => closeMenu(false)}
                                className="ma-link-underline inline-block text-sm leading-5 text-text-2 transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
                              >
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </m.div>
                    ))}
                  </div>
                </div>

                <m.div
                  variants={reducedMotion ? undefined : menuItemVariants}
                  className="col-span-1 border-l border-border pl-6"
                >
                  <p className="mb-4 text-xs font-medium tracking-wider text-text-muted uppercase">
                    {labels.collections}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {collections.map((item) => (
                      <li key={item.id} className="min-w-0">
                        <Link
                          href={item.href}
                          title={item.title}
                          onClick={() => closeMenu(false)}
                          className="ma-link-underline inline-block max-w-full truncate text-sm leading-5 text-text-2 transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/collections"
                    onClick={() => closeMenu(false)}
                    className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-text transition-colors hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    <span>{labels.viewAllCollections}</span>
                    <ArrowRight
                      className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </Link>
                </m.div>
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
