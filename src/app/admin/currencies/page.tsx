import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCurrenciesManager } from "@/components/admin/AdminCurrenciesManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { listAdminCurrencies } from "@/modules/currencies/currency.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Currencies & FX Rates",
};

async function CurrenciesContent() {
  const session = await getOptionalSession();
  const canManage = session ? hasPermission(session.user.role, "settings:manage") : false;

  if (!canManage) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <h1 className="font-display text-2xl font-medium">Administrator Role Required</h1>
          <CardDescription>
            Store currencies and exchange rates can only be configured by an Administrator.
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

  const data = await listAdminCurrencies();
  return <AdminCurrenciesManager currencies={data.currencies} rateHistory={data.rateHistory} />;
}

// Rendered per request (signed-in / URL-driven); a blocking navigation is intended.
export const instant = false;

export default function AdminCurrenciesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CurrenciesContent />
    </Suspense>
  );
}
