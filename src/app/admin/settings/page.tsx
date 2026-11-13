import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SettingsManager } from "@/components/admin/SettingsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { getAllShippingZones, getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Store Settings",
};

async function SettingsContent() {
  const session = await getOptionalSession();
  const canManage = session ? hasPermission(session.user.role, "settings:manage") : false;

  if (!canManage) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <h1 className="font-display text-2xl font-medium">Administrator Role Required</h1>
          <CardDescription>
            Store configuration, tax computation, and shipping courier rules can only be modified by
            an Administrator.
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

  const [settings, zones] = await Promise.all([
    getPublicStoreSettings(),
    getAllShippingZones(false),
  ]);

  return <SettingsManager settings={settings} zones={zones} />;
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SettingsContent />
    </Suspense>
  );
}
