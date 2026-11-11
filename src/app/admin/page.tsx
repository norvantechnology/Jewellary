import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, FolderTree, Gem, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { getAdminDashboardSummary } from "@/modules/catalog/catalog.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Overview",
};

async function AdminDashboardContent() {
  const [summary, session] = await Promise.all([getAdminDashboardSummary(), getOptionalSession()]);
  const canManageSettings = session ? hasPermission(session.user.role, "settings:manage") : false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Maison Operations</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Admin Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live catalogue health, low-stock vault alerts, and studio workspace shortcuts.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>New Product</span>
            </Link>
          </Button>
          {canManageSettings && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/settings">
                <Settings className="size-4" aria-hidden="true" />
                <span>Store Settings</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key Catalogue Metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Pieces</CardDescription>
              <p className="font-display text-3xl font-medium tabular-nums-price">
                {summary.activeProducts}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {summary.draftProducts} draft awaiting publication
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Low-Stock Alerts</CardDescription>
              <p className="font-display text-3xl font-medium tabular-nums-price">
                {summary.lowStockVariantsCount}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Variants at or below threshold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Categories &amp; Facets</CardDescription>
              <p className="font-display text-3xl font-medium tabular-nums-price">
                {summary.categoriesCount} / {summary.facetsCount}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {summary.activeBannersCount} active banners · {summary.publishedArticlesCount}{" "}
                guides
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orders &amp; Enquiries</CardDescription>
              <p className="font-display text-3xl font-medium tabular-nums-price">
                {summary.ordersCount} / {summary.newEnquiriesCount}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total orders · Open enquiries</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Low Stock Alerts & Studio Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-medium text-foreground">
                Vault Low-Stock Alerts
              </h2>
              <CardDescription>
                Variants whose available quantity (on-hand minus reserved) meets or falls below
                threshold.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/inventory?lowStock=1">Open Ledger</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {summary.lowStockAlerts.length === 0 ? (
              <p className="rounded-sm border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                All active variants currently exceed their low-stock thresholds.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {summary.lowStockAlerts.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${item.productId}`}
                        className="font-medium text-foreground hover:text-accent-text hover:underline"
                      >
                        {item.productName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.title} · SKU <span className="font-mono">{item.sku}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.availableQty <= 0 ? "destructive" : "warning"}>
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {item.availableQty} avail (min {item.lowStockThreshold})
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-xl font-medium text-foreground">Studio Shortcuts</h2>
            <CardDescription>Manage collections, stock, and editorial surfaces.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/admin/products">
                <Gem className="size-4 text-accent-text" aria-hidden="true" />
                <span>Manage Catalogue</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/admin/categories">
                <FolderTree className="size-4 text-accent-text" aria-hidden="true" />
                <span>Category Hierarchy</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/admin/inventory">
                <Boxes className="size-4 text-accent-text" aria-hidden="true" />
                <span>Adjust Vault Stock</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/admin/articles">
                <span>Editorial Guides</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/admin/banners">
                <span>Homepage Banners</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
