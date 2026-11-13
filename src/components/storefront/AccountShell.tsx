"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, MapPin, Package, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { useFlipIndicator, useReducedMotionSafe } from "@/lib/motion";
import { roleAtLeast, type UserRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/modules/auth/SignOutButton";

interface AccountShellProps {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  children: React.ReactNode;
}

const ACCOUNT_NAV_ITEMS = [
  { label: "Overview", href: "/account", icon: LayoutGrid, exact: true },
  { label: "Orders", href: "/account/orders", icon: Package, exact: false },
  { label: "Customizations", href: "/account/customizations", icon: Sparkles, exact: false },
  { label: "Addresses", href: "/account/addresses", icon: MapPin, exact: false },
  { label: "Wishlist", href: "/wishlist", icon: Heart, exact: false },
  { label: "Settings", href: "/account/settings", icon: Settings, exact: false },
];

export function AccountShell({ user, children }: AccountShellProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotionSafe();
  const mobileNavRef = React.useRef<HTMLElement>(null);
  const desktopNavRef = React.useRef<HTMLElement>(null);
  const activeHref =
    ACCOUNT_NAV_ITEMS.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    )?.href ?? pathname;

  useFlipIndicator(mobileNavRef, activeHref, reducedMotion);
  useFlipIndicator(desktopNavRef, activeHref, reducedMotion);

  return (
    <div className="container-default py-6 md:py-10 lg:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="type-h1 font-semibold break-words text-foreground">{user.name}</h1>
          <p className="mt-1 text-sm break-words text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {roleAtLeast(user.role, "STAFF") && (
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text transition-colors duration-150 ease-out hover:border-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ShieldCheck className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
              <span>Admin Studio</span>
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      {/* Mobile horizontal navigation pills */}
      <nav
        ref={mobileNavRef}
        aria-label="Account sections"
        className="mb-6 flex scrollbar-none gap-2 overflow-x-auto pb-1 lg:hidden"
      >
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent",
                active
                  ? "border-transparent text-text"
                  : "border-border bg-surface text-text-2 hover:border-border-strong hover:text-text",
              )}
            >
              {active ? (
                <span
                  data-ma-indicator="true"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md border-[1.5px] border-accent bg-accent-tint shadow-sm"
                />
              ) : null}
              <Icon className="relative z-10 size-5 stroke-[1.5]" aria-hidden="true" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav
            ref={desktopNavRef}
            aria-label="Account navigation"
            className="sticky top-24 space-y-1 rounded-lg border border-border bg-surface p-3 shadow-sm"
          >
            {ACCOUNT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent",
                    active ? "text-text" : "text-text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  {active ? (
                    <span
                      data-ma-indicator="true"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-md bg-accent-tint ring-1 ring-accent/35"
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "relative z-10 size-5 stroke-[1.5]",
                      active ? "text-accent-text" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}
