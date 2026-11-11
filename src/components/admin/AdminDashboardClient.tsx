"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Gem,
  MessageSquare,
  Package,
  ShoppingBag,
} from "lucide-react";
import { CsvExportLink } from "@/components/admin/CsvExportLink";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DashboardAnalyticsDTO, DashboardPeriod } from "@/modules/admin/dashboard.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";

interface ThemePaletteSnapshot {
  accent: string;
  accentText: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  card: string;
}

const DEFAULT_SNAPSHOT = JSON.stringify({
  accent: "currentColor",
  accentText: "currentColor",
  foreground: "currentColor",
  mutedForeground: "currentColor",
  border: "currentColor",
  card: "transparent",
});

function subscribeThemeChanges(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  return () => observer.disconnect();
}

function readThemePaletteJson(): string {
  if (typeof window === "undefined") return DEFAULT_SNAPSHOT;
  const styles = getComputedStyle(document.documentElement);
  return JSON.stringify({
    accent: styles.getPropertyValue("--accent").trim() || "currentColor",
    accentText: styles.getPropertyValue("--accent-text").trim() || "currentColor",
    foreground: styles.getPropertyValue("--foreground").trim() || "currentColor",
    mutedForeground: styles.getPropertyValue("--muted-foreground").trim() || "currentColor",
    border: styles.getPropertyValue("--border").trim() || "currentColor",
    card: styles.getPropertyValue("--card").trim() || "transparent",
  });
}

function useHydrated(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums-price",
        positive ? "text-accent-text" : "text-destructive",
      )}
    >
      {positive ? (
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="size-3.5" aria-hidden="true" />
      )}
      {positive ? "+" : ""}
      {delta}%
    </span>
  );
}

export function AdminDashboardClient({ data }: { data: DashboardAnalyticsDTO }) {
  const hydrated = useHydrated();
  const paletteJson = React.useSyncExternalStore(
    subscribeThemeChanges,
    readThemePaletteJson,
    () => DEFAULT_SNAPSHOT,
  );
  const palette = React.useMemo(
    () => JSON.parse(paletteJson) as ThemePaletteSnapshot,
    [paletteJson],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-editorial-label text-accent-text">Maison Analytics</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Admin Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Net revenue, order velocity, vault stock health, and client concierge activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Analytics timeframe"
            className="inline-flex max-w-full flex-wrap rounded-sm border border-border bg-card p-1"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = data.period === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={`/admin?period=${opt.value}`}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
          <CsvExportLink resource="orders" label="Export Orders CSV" />
        </div>
      </div>

      {/* Primary KPI row */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardDescription>Net Revenue</CardDescription>
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="font-display text-3xl tabular-nums-price">
                {formatMoneyExact(data.kpis.revenue, data.currency)}
              </CardTitle>
              <DeltaBadge delta={data.kpis.revenueDeltaPct} />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            After refunds across selected period
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardDescription>Settled Orders</CardDescription>
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="font-display text-3xl tabular-nums-price">
                {data.kpis.orders}
              </CardTitle>
              <DeltaBadge delta={data.kpis.ordersDeltaPct} />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Vs prior equivalent period
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardDescription>Average Order Value</CardDescription>
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="font-display text-3xl tabular-nums-price">
                {formatMoneyExact(data.kpis.aov, data.currency)}
              </CardTitle>
              <DeltaBadge delta={data.kpis.aovDeltaPct} />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Mean settled order value
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardDescription>New Client Registrations</CardDescription>
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="font-display text-3xl tabular-nums-price">
                {data.kpis.newCustomers}
              </CardTitle>
              <DeltaBadge delta={data.kpis.newCustomersDeltaPct} />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active registered accounts
          </CardContent>
        </Card>
      </section>

      {/* Operations Pulse */}
      <section aria-label="Operational queues" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/orders?status=PAID"
          className="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-accent"
        >
          <div>
            <p className="text-xs tracking-wider text-muted-foreground uppercase">To Fulfill</p>
            <p className="mt-1 font-display text-2xl font-medium text-foreground tabular-nums-price">
              {data.operations.ordersToFulfill}
            </p>
          </div>
          <Package className="size-5 text-accent" aria-hidden="true" />
        </Link>

        <Link
          href="/admin/enquiries?status=NEW"
          className="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-accent"
        >
          <div>
            <p className="text-xs tracking-wider text-muted-foreground uppercase">Open Enquiries</p>
            <p className="mt-1 font-display text-2xl font-medium text-foreground tabular-nums-price">
              {data.operations.openEnquiries}
            </p>
          </div>
          <MessageSquare className="size-5 text-accent" aria-hidden="true" />
        </Link>

        <Link
          href="/admin/inventory"
          className="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-accent"
        >
          <div>
            <p className="text-xs tracking-wider text-muted-foreground uppercase">Low Stock</p>
            <p className="mt-1 font-display text-2xl font-medium text-foreground tabular-nums-price">
              {data.operations.lowStockCount}
            </p>
          </div>
          <AlertTriangle className="size-5 text-accent" aria-hidden="true" />
        </Link>

        <Link
          href="/admin/products"
          className="flex items-center justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-accent"
        >
          <div>
            <p className="text-xs tracking-wider text-muted-foreground uppercase">Active Pieces</p>
            <p className="mt-1 font-display text-2xl font-medium text-foreground tabular-nums-price">
              {data.operations.activeProducts}
            </p>
          </div>
          <Gem className="size-5 text-accent" aria-hidden="true" />
        </Link>
      </section>

      {/* Revenue & Volume Charts (warm token palette only) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Revenue Trajectory</CardTitle>
            <CardDescription>Daily net settled commission revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0">
              {hydrated ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aureliaRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={palette.accent} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={palette.accent} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: palette.mutedForeground, fontSize: 11 }}
                      stroke={palette.border}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: palette.mutedForeground, fontSize: 11 }}
                      stroke={palette.border}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                        color: palette.foreground,
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name={`Revenue (${data.currency})`}
                      stroke={palette.accentText}
                      strokeWidth={2}
                      fill="url(#aureliaRevenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-sm bg-muted/40" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-5">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Daily Orders</CardTitle>
            <CardDescription>Order count by day in selected window</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0">
              {hydrated ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                  <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: palette.mutedForeground, fontSize: 11 }}
                      stroke={palette.border}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: palette.mutedForeground, fontSize: 11 }}
                      stroke={palette.border}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                        color: palette.foreground,
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="orders"
                      name="Orders"
                      fill={palette.accent}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-sm bg-muted/40" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom insights */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-display text-2xl">Recent Orders</CardTitle>
              <CardDescription>Latest five client commissions</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/orders">
                <ShoppingBag className="mr-1.5 size-3.5" aria-hidden="true" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentOrders.map((order) => {
                  const meta = ORDER_STATUS_META[order.status];
                  return (
                    <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-foreground underline underline-offset-4 hover:text-accent-text"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.customerName} · {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                        <span className="text-sm font-medium tabular-nums-price">
                          {formatMoneyExact(order.total, order.currency)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-display text-2xl">Top Pieces &amp; Low Stock</CardTitle>
              <CardDescription>Best-selling pieces and vault attention alerts</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/inventory">Manage Vault</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Top Pieces in Period
              </h3>
              {data.topProducts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No settled line items in this timeframe.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {data.topProducts.map((p) => (
                    <li
                      key={p.productId}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link
                        href={`/admin/products/${p.productId}`}
                        className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-accent-text"
                      >
                        {p.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums-price">
                        {p.unitsSold} sold · {formatMoneyExact(p.revenue, data.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.lowStockAlerts.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Low Stock Warnings
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.lowStockAlerts.slice(0, 4).map((item) => (
                    <li
                      key={item.variantId}
                      className="flex items-center justify-between gap-3 rounded-sm border border-border bg-muted/40 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {item.productName} ({item.sku})
                      </span>
                      <Badge
                        variant={item.available === 0 ? "destructive" : "warning"}
                        className="shrink-0"
                      >
                        {item.available} avail
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
