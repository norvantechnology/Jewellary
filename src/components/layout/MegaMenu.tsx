"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { buildNavigationSections, type NavLabels } from "@/components/layout/navigation-data";
import { useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { NavCategoryItem } from "@/types/navigation";

const LazyMegaMenuPortal = dynamic(
  () => import("@/components/layout/MegaMenuPortal").then((mod) => mod.MegaMenuPortal),
  { ssr: false },
);

let prefetchedPortal = false;
function prefetchMegaMenuPortal() {
  if (prefetchedPortal) return;
  prefetchedPortal = true;
  void import("@/components/layout/MegaMenuPortal");
}

const emptySubscribe = () => () => {};

interface MegaMenuProps {
  labels: NavLabels;
  categories: NavCategoryItem[];
}

export function MegaMenu({ categories, labels }: MegaMenuProps) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = React.useState<string | null>(null);
  const open = openForPath === pathname;
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [panelTop, setPanelTop] = React.useState(72);

  const panelId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const hoverOpenTimerRef = React.useRef<number | null>(null);
  const hoverCloseTimerRef = React.useRef<number | null>(null);
  const openedByHoverAtRef = React.useRef<number>(0);

  const { categoryGroups, collections } = React.useMemo(
    () => buildNavigationSections(categories),
    [categories],
  );
  const reducedMotion = useReducedMotionSafe();

  const clearTimers = React.useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const syncPanelTop = React.useCallback(() => {
    const header = triggerRef.current?.closest("header");
    if (header) {
      setPanelTop(Math.max(64, Math.round(header.getBoundingClientRect().bottom)));
    }
  }, []);

  const closeMenu = React.useCallback(
    (restoreFocus = false) => {
      clearTimers();
      setOpenForPath(null);
      if (restoreFocus) {
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    },
    [clearTimers],
  );

  // Measure header bottom & bind Escape, outside click, and focus-out when open
  React.useEffect(() => {
    if (!open) return;

    syncPanelTop();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      closeMenu(false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      closeMenu(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("resize", syncPanelTop);
    window.addEventListener("scroll", syncPanelTop, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("resize", syncPanelTop);
      window.removeEventListener("scroll", syncPanelTop);
    };
  }, [open, syncPanelTop, closeMenu]);

  React.useEffect(() => () => clearTimers(), [clearTimers]);

  const [hasOpenedPortal, setHasOpenedPortal] = React.useState(false);

  const handleMouseEnterZone = () => {
    prefetchMegaMenuPortal();
    clearTimers();
    if (!open) {
      const pathAtEnter = pathname;
      hoverOpenTimerRef.current = window.setTimeout(() => {
        syncPanelTop();
        openedByHoverAtRef.current = Date.now();
        setHasOpenedPortal(true);
        setOpenForPath(pathAtEnter);
      }, 110);
    }
  };

  const handleMouseLeaveZone = () => {
    clearTimers();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setOpenForPath(null);
    }, 160);
  };

  const handleTriggerClick = () => {
    prefetchMegaMenuPortal();
    clearTimers();
    if (open) {
      // Avoid immediate hover-open -> click flicker closing the menu on touch/mouse click
      if (Date.now() - openedByHoverAtRef.current < 260) {
        openedByHoverAtRef.current = 0;
        return;
      }
      setOpenForPath(null);
      return;
    }
    syncPanelTop();
    setHasOpenedPortal(true);
    setOpenForPath(pathname);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      prefetchMegaMenuPortal();
      if (!open) {
        syncPanelTop();
        setHasOpenedPortal(true);
        setOpenForPath(pathname);
      }
      window.requestAnimationFrame(() => {
        const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>("a[href]");
        firstLink?.focus();
      });
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(
      panelRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [],
    );
    if (links.length === 0) return;

    const currentIndex = links.findIndex((el) => el === document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = currentIndex >= 0 ? (currentIndex + 1) % links.length : 0;
      links[next]?.focus();
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const prev =
        currentIndex >= 0 ? (currentIndex - 1 + links.length) % links.length : links.length - 1;
      links[prev]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      links[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      links[links.length - 1]?.focus();
    }
  };

  const navLinkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-[72px] shrink-0 items-center text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
      "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:origin-left after:bg-accent after:transition-transform after:duration-200 after:ease-out",
      active
        ? "text-text after:scale-x-100"
        : "text-text-2 hover:text-text after:scale-x-0 hover:after:scale-x-100",
    );

  const isAllJewelleryActive = pathname === "/collections";
  const isCollectionsActive = open || pathname.startsWith("/collections/");
  const isGuidesActive = pathname.startsWith("/guides");
  const isAtelierActive = pathname === "/about";
  const isConciergeActive = pathname === "/contact";

  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
      <Link href="/collections" className={navLinkClass(isAllJewelleryActive)}>
        {labels.allJewellery}
      </Link>

      <div
        onMouseEnter={handleMouseEnterZone}
        onMouseLeave={handleMouseLeaveZone}
        className="relative flex items-center"
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="true"
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          className={cn(navLinkClass(isCollectionsActive), "cursor-pointer gap-1")}
        >
          <span>{labels.collections}</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-150",
              open && "rotate-180 text-foreground",
            )}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </div>

      <Link href="/guides" className={navLinkClass(isGuidesActive)}>
        {labels.guides}
      </Link>
      <Link href="/about" className={navLinkClass(isAtelierActive)}>
        {labels.atelier}
      </Link>
      <Link href="/contact" className={navLinkClass(isConciergeActive)}>
        {labels.concierge}
      </Link>

      {mounted && (hasOpenedPortal || open) ? (
        <LazyMegaMenuPortal
          open={open}
          panelTop={panelTop}
          panelId={panelId}
          panelRef={panelRef}
          reducedMotion={reducedMotion}
          categoryGroups={categoryGroups}
          collections={collections}
          labels={labels}
          closeMenu={closeMenu}
          handleMouseEnterZone={handleMouseEnterZone}
          handleMouseLeaveZone={handleMouseLeaveZone}
          handlePanelKeyDown={handlePanelKeyDown}
        />
      ) : null}
    </nav>
  );
}

export function MegaMenuFallback({ labels }: { labels: NavLabels }) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
      <Link
        href="/collections"
        className="inline-flex h-[72px] items-center text-sm font-medium text-muted-foreground"
      >
        {labels.allJewellery}
      </Link>
      <Link
        href="/collections"
        className="inline-flex h-[72px] items-center text-sm font-medium text-muted-foreground"
      >
        {labels.collections}
      </Link>
      <Link
        href="/guides"
        className="inline-flex h-[72px] items-center text-sm font-medium text-muted-foreground"
      >
        {labels.guides}
      </Link>
      <Link
        href="/about"
        className="inline-flex h-[72px] items-center text-sm font-medium text-muted-foreground"
      >
        {labels.atelier}
      </Link>
      <Link
        href="/contact"
        className="inline-flex h-[72px] items-center text-sm font-medium text-muted-foreground"
      >
        {labels.concierge}
      </Link>
    </nav>
  );
}
