import { NextResponse } from "next/server";
import { Prisma, type NewsletterStatus } from "@/generated/prisma/client";
import { buildCsvDocument } from "@/lib/csv";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/server/audit";
import { requirePermission } from "@/server/dal";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

function exportFilePrefix() {
  return (
    env.NEXT_PUBLIC_SITE_NAME.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "atelier"
  );
}

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    const slug = resource.replace(/\.csv$/i, "").toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const prefix = exportFilePrefix();

    if (slug === "customers") {
      const actor = await requirePermission("customers:export");
      const users = await db.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        take: 5000,
      });

      const userIds = users.map((u) => u.id);
      const spendRows =
        userIds.length > 0
          ? await db.$queryRaw<Array<{ userId: string; spend: number }>>(Prisma.sql`
              SELECT
                "userId",
                COALESCE(SUM(GREATEST(0, "total" - "refundedAmount")), 0)::float8 AS spend
              FROM "Order"
              WHERE "userId" IN (${Prisma.join(userIds)})
                AND "status" NOT IN ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED')
              GROUP BY "userId"
            `)
          : [];
      const spendByUser = new Map(spendRows.map((r) => [r.userId, Number(r.spend ?? 0)]));

      const headers = [
        "ID",
        "Name",
        "Email",
        "Phone",
        "Role",
        "Verified",
        "Orders",
        "Lifetime Spend",
        "Created At",
      ];
      const rows = users.map((u) => {
        const spend = spendByUser.get(u.id) ?? 0;
        return [
          u.id,
          u.name,
          u.email,
          u.phone ?? "",
          u.role,
          u.emailVerified ? "Yes" : "No",
          u._count.orders,
          spend.toFixed(2),
          u.createdAt.toISOString(),
        ];
      });

      await writeAuditLog({
        actorId: actor.user.id,
        actorEmail: actor.user.email,
        actorRole: actor.user.role,
        action: "export.csv",
        entityType: "customers",
        after: { rowCount: rows.length },
      });

      return new NextResponse(buildCsvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${prefix}-customers-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "orders") {
      const actor = await requirePermission("exports:operational");
      const orders = await db.order.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          guestEmail: true,
          shippingAddress: true,
          currency: true,
          subtotal: true,
          shippingCost: true,
          taxAmount: true,
          total: true,
          refundedAmount: true,
          carrier: true,
          trackingNumber: true,
          createdAt: true,
          paidAt: true,
          user: { select: { name: true, email: true, anonymizedAt: true } },
        },
        take: 5000,
      });

      const orderIds = orders.map((o) => o.id);
      const qtyGroups =
        orderIds.length > 0
          ? await db.orderItem.groupBy({
              by: ["orderId"],
              where: { orderId: { in: orderIds } },
              _sum: { quantity: true },
            })
          : [];
      const qtyByOrder = new Map(qtyGroups.map((g) => [g.orderId, g._sum.quantity ?? 0]));

      const headers = [
        "Order Number",
        "Status",
        "Client Name",
        "Contact Email",
        "Items",
        "Currency",
        "Subtotal",
        "Shipping",
        "Tax",
        "Total",
        "Refunded",
        "Carrier",
        "Tracking Number",
        "Created At",
        "Paid At",
      ];
      const rows = orders.map((o) => {
        const shipping = o.shippingAddress as { fullName?: string } | null;
        return [
          o.orderNumber,
          o.status,
          o.user && !o.user.anonymizedAt ? o.user.name : (shipping?.fullName ?? "Guest Client"),
          o.user && !o.user.anonymizedAt ? o.user.email : (o.guestEmail ?? ""),
          qtyByOrder.get(o.id) ?? 0,
          o.currency,
          o.subtotal.toFixed(2),
          o.shippingCost.toFixed(2),
          o.taxAmount.toFixed(2),
          o.total.toFixed(2),
          o.refundedAmount.toFixed(2),
          o.carrier ?? "",
          o.trackingNumber ?? "",
          o.createdAt.toISOString(),
          o.paidAt?.toISOString() ?? "",
        ];
      });

      await writeAuditLog({
        actorId: actor.user.id,
        actorEmail: actor.user.email,
        actorRole: actor.user.role,
        action: "export.csv",
        entityType: "orders",
        after: { rowCount: rows.length },
      });

      return new NextResponse(buildCsvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${prefix}-orders-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "products") {
      const actor = await requirePermission("exports:operational");
      const products = await db.product.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          priceMode: true,
          basePrice: true,
          category: { select: { name: true } },
          variants: { select: { stockQty: true, reservedQty: true } },
        },
        take: 5000,
      });

      const headers = [
        "Product ID",
        "Name",
        "Slug",
        "Category",
        "Status",
        "Price Mode",
        "Base Price",
        "Total Variants",
        "Available Stock",
      ];
      const rows = products.map((p) => {
        const available = p.variants.reduce(
          (sum, v) => sum + Math.max(0, v.stockQty - v.reservedQty),
          0,
        );
        return [
          p.id,
          p.name,
          p.slug,
          p.category?.name ?? "",
          p.status,
          p.priceMode,
          p.basePrice?.toFixed(2) ?? "",
          p.variants.length,
          available,
        ];
      });

      await writeAuditLog({
        actorId: actor.user.id,
        actorEmail: actor.user.email,
        actorRole: actor.user.role,
        action: "export.csv",
        entityType: "products",
        after: { rowCount: rows.length },
      });

      return new NextResponse(buildCsvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${prefix}-products-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "inventory") {
      const actor = await requirePermission("exports:operational");
      const variants = await db.productVariant.findMany({
        where: { product: { deletedAt: null } },
        include: { product: { select: { name: true, status: true } } },
        orderBy: { sku: "asc" },
        take: 5000,
      });

      const headers = [
        "SKU",
        "Product",
        "Variant",
        "Status",
        "Stock Qty",
        "Reserved Qty",
        "Available Qty",
        "Low Stock Threshold",
      ];
      const rows = variants.map((v) => [
        v.sku,
        v.product.name,
        v.title,
        v.product.status,
        v.stockQty,
        v.reservedQty,
        Math.max(0, v.stockQty - v.reservedQty),
        v.lowStockThreshold,
      ]);

      await writeAuditLog({
        actorId: actor.user.id,
        actorEmail: actor.user.email,
        actorRole: actor.user.role,
        action: "export.csv",
        entityType: "inventory",
        after: { rowCount: rows.length },
      });

      return new NextResponse(buildCsvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${prefix}-inventory-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "newsletter") {
      const actor = await requirePermission("customers:export");
      const url = new URL(request.url);
      const q = url.searchParams.get("q")?.trim();
      const rawStatus = url.searchParams.get("status");
      const validStatuses: NewsletterStatus[] = ["PENDING", "CONFIRMED", "UNSUBSCRIBED"];
      const status = validStatuses.includes(rawStatus as NewsletterStatus)
        ? (rawStatus as NewsletterStatus)
        : undefined;

      const where: Prisma.NewsletterSubscriberWhereInput = {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { source: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const subscribers = await db.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10000,
      });

      const headers = [
        "ID",
        "Email",
        "Status",
        "Source",
        "Consented At",
        "Verified At",
        "Unsubscribed At",
        "Created At",
      ];
      const rows = subscribers.map((s) => [
        s.id,
        s.email,
        s.status,
        s.source ?? "",
        s.consentedAt.toISOString(),
        s.verifiedAt?.toISOString() ?? "",
        s.unsubscribedAt?.toISOString() ?? "",
        s.createdAt.toISOString(),
      ]);

      await writeAuditLog({
        actorId: actor.user.id,
        actorEmail: actor.user.email,
        actorRole: actor.user.role,
        action: "export.csv",
        entityType: "newsletter",
        after: { rowCount: rows.length, status: status ?? "ALL" },
      });

      return new NextResponse(buildCsvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${prefix}-newsletter-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported export resource." }, { status: 404 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to generate CSV export." }, { status: 500 });
  }
}
