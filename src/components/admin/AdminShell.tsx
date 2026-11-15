"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Coins,
  ExternalLink,
  FileText,
  LayoutTemplate,
  FolderTree,
  Gem,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  ScrollText,
  Search,
  MessagesSquare,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { useAdminInboxRealtime } from "@/components/providers/useChatRealtime";
import { Logo } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/modules/auth/SignOutButton";

interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  exact?: boolean;
}

interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    heading: "Studio",
    items: [
      {
        label: "Overview",
        href: "/admin",
        icon: LayoutDashboard,
        permission: "admin:dashboard",
        exact: true,
      },
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag, permission: "orders:read" },
      { label: "Customers", href: "/admin/customers", icon: Users, permission: "customers:read" },
      { label: "Newsletter", href: "/admin/newsletter", icon: Mail, permission: "customers:read" },
      {
        label: "Customizations",
        href: "/admin/customizations",
        icon: Sparkles,
        permission: "customization:manage",
      },
      {
        label: "Messages",
        href: "/admin/messages",
        icon: MessagesSquare,
        permission: "chat:manage",
      },
      {
        label: "Inquiries",
        href: "/admin/enquiries",
        icon: MessageSquare,
        permission: "enquiries:manage",
      },
    ],
  },
  {
    heading: "Catalog & Vault",
    items: [
      { label: "Products", href: "/admin/products", icon: Gem, permission: "catalog:write" },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: FolderTree,
        permission: "catalog:write",
      },
      {
        label: "Attributes & Facets",
        href: "/admin/attributes",
        icon: SlidersHorizontal,
        permission: "catalog:write",
      },
      {
        label: "Inventory Ledger",
        href: "/admin/inventory",
        icon: Boxes,
        permission: "inventory:adjust",
      },
    ],
  },
  {
    heading: "Content & Editorial",
    items: [
      {
        label: "Page Content",
        href: "/admin/content",
        icon: LayoutTemplate,
        permission: "content:manage",
      },
      { label: "Banners", href: "/admin/banners", icon: ImageIcon, permission: "content:manage" },
      {
        label: "Articles & Guides",
        href: "/admin/articles",
        icon: FileText,
        permission: "content:manage",
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        label: "Currencies & FX",
        href: "/admin/currencies",
        icon: Coins,
        permission: "settings:manage",
      },
      {
        label: "SEO & Growth",
        href: "/admin/seo",
        icon: Search,
        permission: "settings:manage",
      },
      {
        label: "Store & Shipping",
        href: "/admin/settings",
        icon: Settings,
        permission: "settings:manage",
      },
      {
        label: "Audit Log",
        href: "/admin/audit-log",
        icon: ScrollText,
        permission: "audit:read",
      },
    ],
  },
];

function AdminNavLinks({
  role,
  pathname,
  onNavigate,
  chatUnreadCount = 0,
}: {
  role: UserRole;
  pathname: string;
  onNavigate?: () => void;
  chatUnreadCount?: number;
}) {
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-6">
      {ADMIN_NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => hasPermission(role, item.permission));
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.heading} className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isActive
                          ? "bg-primary text-on-primary"
                          : "text-text-2 hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icon className="size-5 shrink-0 stroke-[1.5]" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {item.href === "/admin/messages" && chatUnreadCount > 0 ? (
                        <span
                          aria-label={`${chatUnreadCount} unread messages`}
                          className={cn(
                            "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            isActive ? "bg-accent text-on-accent" : "bg-primary text-on-primary",
                          )}
                        >
                          {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  siteName,
  user,
  children,
}: {
  siteName: string;
  user: AdminUserSummary;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [quickScope, setQuickScope] = React.useState<"orders" | "products" | "customers">("orders");
  const [quickQuery, setQuickQuery] = React.useState("");
  const [chatUnreadCount, setChatUnreadCount] = React.useState(0);
  const canManageChat = hasPermission(user.role, "chat:manage");

  const refreshUnreadCount = React.useCallback(async () => {
    if (!canManageChat) return;
    try {
      const res = await fetch("/api/chat/conversations?scope=admin&limit=1", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        data?: { totalUnreadCount?: number };
      };
      if (typeof body.data?.totalUnreadCount === "number") {
        setChatUnreadCount(body.data.totalUnreadCount);
      }
    } catch {
      // Non-blocking badge poll
    }
  }, [canManageChat]);

  React.useEffect(() => {
    if (!canManageChat) return;
    let active = true;
    fetch("/api/chat/conversations?scope=admin&limit=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ok?: boolean; data?: { totalUnreadCount?: number } } | null) => {
        if (active && typeof body?.data?.totalUnreadCount === "number") {
          setChatUnreadCount(body.data.totalUnreadCount);
        }
      })
      .catch(() => {
        // Non-blocking badge poll
      });
    return () => {
      active = false;
    };
  }, [canManageChat, pathname]);

  useAdminInboxRealtime({
    enabled: canManageChat,
    onInboxEvent: () => {
      void refreshUnreadCount();
    },
  });

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = quickQuery.trim();
    const targetPath =
      quickScope === "products"
        ? "/admin/products"
        : quickScope === "customers"
          ? "/admin/customers"
          : "/admin/orders";
    router.push(q ? `${targetPath}?q=${encodeURIComponent(q)}` : targetPath);
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background text-foreground lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Logo siteName={siteName} linkClassName="min-w-0" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminNavLinks role={user.role} pathname={pathname} chatUnreadCount={chatUnreadCount} />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="outline">{user.role}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 justify-start gap-1.5">
              <Link href="/">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Storefront</span>
              </Link>
            </Button>
            <ThemeSwitcher compact />
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar for mobile & tablet, compact header strip on desktop */}
        <header className="safe-area-pt sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-header-bg px-4 backdrop-blur lg:h-16 lg:gap-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Open admin navigation"
                  className="size-11 shrink-0 lg:hidden"
                >
                  <Menu className="size-6 stroke-[1.5]" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(86vw,320px)] flex-col p-0">
                <SheetHeader className="safe-area-pt border-b border-border px-4 py-3.5 text-left">
                  <SheetTitle className="min-w-0">
                    <Logo siteName={siteName} onClick={() => setMobileOpen(false)} />
                  </SheetTitle>
                  <SheetDescription className="truncate text-xs">
                    Signed in as {user.email} ({user.role})
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <AdminNavLinks
                    role={user.role}
                    pathname={pathname}
                    chatUnreadCount={chatUnreadCount}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
                <div className="safe-area-pb space-y-3 border-t border-border p-4">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-2"
                  >
                    <Link href="/" onClick={() => setMobileOpen(false)}>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span>Return to Storefront</span>
                    </Link>
                  </Button>
                  <SignOutButton />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <span className="text-xs font-medium tracking-[0.14em] text-accent-text uppercase">
                Store admin
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {" "}
                — Shinora Jewels
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <form
              onSubmit={handleQuickSearch}
              role="search"
              aria-label="Quick studio search"
              className="hidden items-center gap-1.5 md:flex"
            >
              <NativeSelect
                aria-label="Search target"
                value={quickScope}
                onChange={(e) =>
                  setQuickScope(e.target.value as "orders" | "products" | "customers")
                }
                className="h-9 min-h-9 w-28 text-xs"
              >
                <option value="orders">Orders</option>
                {hasPermission(user.role, "catalog:write") && (
                  <option value="products">Products</option>
                )}
                {hasPermission(user.role, "customers:read") && (
                  <option value="customers">Clients</option>
                )}
              </NativeSelect>
              <Input
                type="search"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search studio..."
                aria-label="Search studio query"
                className="h-9 w-44 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" aria-label="Execute studio search">
                <Search className="size-3.5" aria-hidden="true" />
              </Button>
            </form>
            <Badge variant="primary" className="hidden sm:inline-flex">
              {user.role}
            </Badge>
            <div className="lg:hidden">
              <ThemeSwitcher compact />
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex lg:hidden">
              <Link href="/">Storefront</Link>
            </Button>
          </div>
        </header>

        <main id="admin-main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
