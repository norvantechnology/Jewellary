import "server-only";
import type { OrderStatus } from "@/generated/prisma/client";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { db } from "@/server/db";

export type DashboardPeriod = "today" | "7d" | "30d" | "90d";

const SETTLED_REVENUE_STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
];

function resolvePeriodDates(period: DashboardPeriod) {
  const now = new Date();
  const end = now;
  let start: Date;
  let bucketDays: number;

  switch (period) {
    case "today": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      bucketDays = 1;
      break;
    }
    case "7d": {
      start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      bucketDays = 7;
      break;
    }
    case "90d": {
      start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      bucketDays = 90;
      break;
    }
    case "30d":
    default: {
      start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      bucketDays = 30;
      break;
    }
  }

  const windowMs = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - windowMs);

  return { start, end, prevStart, prevEnd, bucketDays };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export interface DashboardAnalyticsDTO {
  period: DashboardPeriod;
  currency: string;
  kpis: {
    revenue: number;
    revenueDeltaPct: number | null;
    orders: number;
    ordersDeltaPct: number | null;
    aov: number;
    aovDeltaPct: number | null;
    newCustomers: number;
    newCustomersDeltaPct: number | null;
  };
  operations: {
    ordersToFulfill: number;
    openEnquiries: number;
    lowStockCount: number;
    activeProducts: number;
  };
  series: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    productId: string;
    title: string;
    unitsSold: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    status: OrderStatus;
    total: string;
    currency: string;
    createdAt: string;
  }>;
  lowStockAlerts: Array<{
    variantId: string;
    productId: string;
    productName: string;
    sku: string;
    available: number;
    threshold: number;
  }>;
}

export async function getAdminDashboardAnalytics(
  rawPeriod?: string,
): Promise<DashboardAnalyticsDTO> {
  const period: DashboardPeriod =
    rawPeriod === "today" || rawPeriod === "7d" || rawPeriod === "90d" ? rawPeriod : "30d";
  const { start, end, prevStart, prevEnd, bucketDays } = resolvePeriodDates(period);

  const [
    settings,
    currentOrders,
    prevOrders,
    newCustomers,
    prevCustomers,
    ordersToFulfill,
    openEnquiries,
    activeProducts,
    allVariants,
    recentOrders,
    soldItems,
  ] = await Promise.all([
    getPublicStoreSettings(),
    db.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: SETTLED_REVENUE_STATUSES },
      },
      select: {
        total: true,
        refundedAmount: true,
        createdAt: true,
      },
    }),
    db.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: { in: SETTLED_REVENUE_STATUSES },
      },
      select: {
        total: true,
        refundedAmount: true,
      },
    }),
    db.user.count({
      where: {
        role: "CUSTOMER",
        anonymizedAt: null,
        createdAt: { gte: start, lte: end },
      },
    }),
    db.user.count({
      where: {
        role: "CUSTOMER",
        anonymizedAt: null,
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
    db.order.count({
      where: { status: { in: ["PAID", "PROCESSING", "PACKED"] } },
    }),
    db.enquiry.count({
      where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    }),
    db.product.count({
      where: { deletedAt: null, status: "ACTIVE" },
    }),
    db.productVariant.findMany({
      where: { product: { deletedAt: null } },
      select: {
        id: true,
        sku: true,
        stockQty: true,
        reservedQty: true,
        lowStockThreshold: true,
        product: { select: { id: true, name: true } },
      },
      orderBy: { stockQty: "asc" },
      take: 100,
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        user: { select: { name: true, anonymizedAt: true } },
        shippingAddress: true,
      },
    }),
    db.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { in: SETTLED_REVENUE_STATUSES },
        },
      },
      select: {
        productId: true,
        titleSnapshot: true,
        quantity: true,
        lineTotal: true,
      },
    }),
  ]);

  let currentRevenue = 0;
  for (const o of currentOrders) {
    currentRevenue += Math.max(0, Number(o.total) - Number(o.refundedAmount));
  }
  let prevRevenue = 0;
  for (const o of prevOrders) {
    prevRevenue += Math.max(0, Number(o.total) - Number(o.refundedAmount));
  }

  const currentCount = currentOrders.length;
  const prevCount = prevOrders.length;
  const currentAov = currentCount > 0 ? currentRevenue / currentCount : 0;
  const prevAov = prevCount > 0 ? prevRevenue / prevCount : 0;

  // Build continuous daily time series buckets
  const bucketMap = new Map<
    string,
    { date: string; label: string; revenue: number; orders: number }
  >();
  for (let i = 0; i < bucketDays; i += 1) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const isoDay = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    bucketMap.set(isoDay, { date: isoDay, label, revenue: 0, orders: 0 });
  }

  for (const o of currentOrders) {
    const isoDay = o.createdAt.toISOString().slice(0, 10);
    const bucket = bucketMap.get(isoDay);
    if (bucket) {
      bucket.revenue = Number(
        (bucket.revenue + Math.max(0, Number(o.total) - Number(o.refundedAmount))).toFixed(2),
      );
      bucket.orders += 1;
    }
  }

  const productAgg = new Map<string, { title: string; unitsSold: number; revenue: number }>();
  for (const line of soldItems) {
    const existing = productAgg.get(line.productId);
    const rev = Number(line.lineTotal);
    if (existing) {
      existing.unitsSold += line.quantity;
      existing.revenue += rev;
    } else {
      productAgg.set(line.productId, {
        title: line.titleSnapshot,
        unitsSold: line.quantity,
        revenue: rev,
      });
    }
  }

  const topProducts = Array.from(productAgg.entries())
    .map(([productId, val]) => ({
      productId,
      title: val.title,
      unitsSold: val.unitsSold,
      revenue: Number(val.revenue.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const lowStockAlerts = allVariants
    .map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      sku: v.sku,
      available: Math.max(0, v.stockQty - v.reservedQty),
      threshold: v.lowStockThreshold,
    }))
    .filter((v) => v.available <= v.threshold)
    .slice(0, 8);

  return {
    period,
    currency: settings.currency,
    kpis: {
      revenue: Number(currentRevenue.toFixed(2)),
      revenueDeltaPct: calcDeltaPct(currentRevenue, prevRevenue),
      orders: currentCount,
      ordersDeltaPct: calcDeltaPct(currentCount, prevCount),
      aov: Number(currentAov.toFixed(2)),
      aovDeltaPct: calcDeltaPct(currentAov, prevAov),
      newCustomers,
      newCustomersDeltaPct: calcDeltaPct(newCustomers, prevCustomers),
    },
    operations: {
      ordersToFulfill,
      openEnquiries,
      lowStockCount: lowStockAlerts.length,
      activeProducts,
    },
    series: Array.from(bucketMap.values()),
    topProducts,
    recentOrders: recentOrders.map((o) => {
      const shipping = o.shippingAddress as { fullName?: string } | null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName:
          o.user && !o.user.anonymizedAt ? o.user.name : (shipping?.fullName ?? "Guest Client"),
        status: o.status,
        total: o.total.toFixed(2),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
      };
    }),
    lowStockAlerts,
  };
}
