import "server-only";
import { Prisma, type OrderStatus } from "@/generated/prisma/client";
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

const SETTLED_REVENUE_STATUS_SQL = Prisma.join(
  SETTLED_REVENUE_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`),
);

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
    currentSeriesRows,
    prevAggRows,
    newCustomers,
    prevCustomers,
    ordersToFulfill,
    openEnquiries,
    activeProducts,
    lowStockRows,
    recentOrders,
    topProductRows,
  ] = await Promise.all([
    getPublicStoreSettings(),
    db.$queryRaw<Array<{ day: string; orders: number; revenue: number }>>(Prisma.sql`
      SELECT
        TO_CHAR(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS orders,
        COALESCE(SUM(GREATEST(0, "total" - "refundedAmount")), 0)::float8 AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND "status" IN (${SETTLED_REVENUE_STATUS_SQL})
      GROUP BY 1
    `),
    db.$queryRaw<Array<{ orders: number; revenue: number }>>(Prisma.sql`
      SELECT
        COUNT(*)::int AS orders,
        COALESCE(SUM(GREATEST(0, "total" - "refundedAmount")), 0)::float8 AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${prevStart}
        AND "createdAt" <= ${prevEnd}
        AND "status" IN (${SETTLED_REVENUE_STATUS_SQL})
    `),
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
    db.$queryRaw<
      Array<{
        variantId: string;
        productId: string;
        productName: string;
        sku: string;
        available: number;
        threshold: number;
        totalLowStock: number;
      }>
    >(Prisma.sql`
      SELECT
        v."id" AS "variantId",
        p."id" AS "productId",
        p."name" AS "productName",
        v."sku",
        GREATEST(0, v."stockQty" - v."reservedQty")::int AS "available",
        v."lowStockThreshold"::int AS "threshold",
        COUNT(*) OVER()::int AS "totalLowStock"
      FROM "ProductVariant" v
      INNER JOIN "Product" p ON p."id" = v."productId"
      WHERE p."deletedAt" IS NULL
        AND (v."stockQty" - v."reservedQty") <= v."lowStockThreshold"
      ORDER BY (v."stockQty" - v."reservedQty") ASC, v."updatedAt" DESC
      LIMIT 8
    `),
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
    db.$queryRaw<
      Array<{ productId: string; title: string; unitsSold: number; revenue: number }>
    >(Prisma.sql`
      SELECT
        oi."productId",
        MAX(oi."titleSnapshot") AS title,
        COALESCE(SUM(oi."quantity"), 0)::int AS "unitsSold",
        COALESCE(SUM(oi."lineTotal"), 0)::float8 AS revenue
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."createdAt" >= ${start}
        AND o."createdAt" <= ${end}
        AND o."status" IN (${SETTLED_REVENUE_STATUS_SQL})
      GROUP BY oi."productId"
      ORDER BY revenue DESC
      LIMIT 5
    `),
  ]);

  let currentRevenue = 0;
  let currentCount = 0;

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

  for (const row of currentSeriesRows) {
    const rowRev = Number(row.revenue ?? 0);
    const rowOrders = Number(row.orders ?? 0);
    currentRevenue += rowRev;
    currentCount += rowOrders;
    const bucket = bucketMap.get(row.day);
    if (bucket) {
      bucket.revenue = Number(rowRev.toFixed(2));
      bucket.orders = rowOrders;
    }
  }

  const prevRevenue = Number(prevAggRows[0]?.revenue ?? 0);
  const prevCount = Number(prevAggRows[0]?.orders ?? 0);
  const currentAov = currentCount > 0 ? currentRevenue / currentCount : 0;
  const prevAov = prevCount > 0 ? prevRevenue / prevCount : 0;

  const topProducts = topProductRows.map((row) => ({
    productId: row.productId,
    title: row.title,
    unitsSold: Number(row.unitsSold ?? 0),
    revenue: Number(Number(row.revenue ?? 0).toFixed(2)),
  }));

  const lowStockCount = Number(lowStockRows[0]?.totalLowStock ?? 0);
  const lowStockAlerts = lowStockRows.map((v) => ({
    variantId: v.variantId,
    productId: v.productId,
    productName: v.productName,
    sku: v.sku,
    available: v.available,
    threshold: v.threshold,
  }));

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
      lowStockCount,
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
