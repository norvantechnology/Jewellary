import { NextResponse } from "next/server";
import { buildCsvDocument } from "@/lib/csv";
import { writeAuditLog } from "@/server/audit";
import { requirePermission } from "@/server/dal";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export async function GET(_request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    const slug = resource.replace(/\.csv$/i, "").toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    if (slug === "customers") {
      const actor = await requirePermission("customers:export");
      const users = await db.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { orders: true } },
          orders: {
            where: { status: { notIn: ["PENDING_PAYMENT", "PAYMENT_FAILED", "CANCELLED"] } },
            select: { total: true, refundedAmount: true },
          },
        },
        take: 5000,
      });

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
        const spend = u.orders.reduce(
          (sum, o) => sum + Math.max(0, Number(o.total) - Number(o.refundedAmount)),
          0,
        );
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
          "Content-Disposition": `attachment; filename="aurelia-customers-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "orders") {
      const actor = await requirePermission("exports:operational");
      const orders = await db.order.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, anonymizedAt: true } },
          items: { select: { quantity: true } },
        },
        take: 5000,
      });

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
          o.items.reduce((sum, i) => sum + i.quantity, 0),
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
          "Content-Disposition": `attachment; filename="aurelia-orders-${today}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (slug === "products") {
      const actor = await requirePermission("exports:operational");
      const products = await db.product.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { name: true } },
          variants: { select: { sku: true, stockQty: true, reservedQty: true } },
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
          "Content-Disposition": `attachment; filename="aurelia-products-${today}.csv"`,
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
          "Content-Disposition": `attachment; filename="aurelia-inventory-${today}.csv"`,
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
