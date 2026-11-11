"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, MapPin, Package, Settings, ShieldCheck } from "lucide-react";
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
  { label: "Addresses", href: "/account/addresses", icon: MapPin, exact: false },
  { label: "Wishlist", href: "/wishlist", icon: Heart, exact: false },
  { label: "Settings", href: "/account/settings", icon: Settings, exact: false },
];

export function AccountShell({ user, children }: AccountShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-sans text-editorial-label text-accent-text">Client Vault</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roleAtLeast(user.role, "STAFF") && (
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
              Admin Studio
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      {/* Mobile horizontal navigation pills */}
      <nav aria-label="Account sections" className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-sm border px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-card text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav
            aria-label="Account navigation"
            className="sticky top-24 space-y-1 rounded-md border border-border bg-card p-3"
          >
            {ACCOUNT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("size-4", active ? "text-accent" : "text-muted-foreground")}
                    aria-hidden="true"
                  />
                  {item.label}
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
