import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SeoHubManager } from "@/components/admin/SeoHubManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { getAllActiveCategoriesTree } from "@/modules/catalog/catalog.public";
import { getSeoDashboardSnapshot } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "SEO & Growth",
};

async function SeoHubContent() {
  const session = await getOptionalSession();
  const canManage = session ? hasPermission(session.user.role, "settings:manage") : false;

  if (!canManage) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <h1 className="font-display text-2xl font-medium">Administrator Role Required</h1>
          <CardDescription>
            SEO templates, redirects, landing facets, and site audits can only be managed by an
            Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin">Return to Studio Overview</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const [snapshot, settings, categories] = await Promise.all([
    getSeoDashboardSnapshot(),
    getPublicStoreSettings(),
    getAllActiveCategoriesTree(),
  ]);

  const flatCategories: Array<{ name: string; path: string }> = [];
  for (const cat of categories) {
    flatCategories.push({ name: cat.name, path: cat.path });
    for (const child of cat.children) {
      flatCategories.push({ name: `${cat.name} / ${child.name}`, path: child.path });
    }
  }

  const latestAudit = snapshot.latestAudit
    ? {
        id: snapshot.latestAudit.id,
        score: snapshot.latestAudit.score,
        totalUrls: snapshot.latestAudit.totalUrls,
        passedCount: snapshot.latestAudit.passedCount,
        warningCount: snapshot.latestAudit.warningCount,
        errorCount: snapshot.latestAudit.errorCount,
        createdAt: snapshot.latestAudit.createdAt.toISOString(),
        summary: (snapshot.latestAudit.summary ?? {}) as Record<string, unknown>,
        issues: Array.isArray(snapshot.latestAudit.issues)
          ? (snapshot.latestAudit.issues as Array<{
              url: string;
              entityType: string;
              entityId: string;
              severity: "error" | "warning";
              code: string;
              message: string;
            }>)
          : [],
      }
    : null;

  return (
    <SeoHubManager
      settings={settings}
      categories={flatCategories}
      latestAudit={latestAudit}
      aiBotSummary={snapshot.aiBotSummary}
      landingFacets={snapshot.landingFacets}
      staticPages={snapshot.staticPages}
      redirects={snapshot.redirects}
      bulkItems={snapshot.bulkItems}
    />
  );
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminSeoPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
      }
    >
      <SeoHubContent />
    </Suspense>
  );
}
