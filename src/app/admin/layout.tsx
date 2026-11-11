import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Container, Section } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roleAtLeast } from "@/lib/permissions";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: {
    default: "Admin Studio",
    template: "%s | Admin Studio",
  },
  robots: { index: false, follow: false },
};

async function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const [session, settings] = await Promise.all([getOptionalSession(), getPublicStoreSettings()]);

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (!roleAtLeast(session.user.role, "STAFF")) {
    return (
      <main id="main-content" className="min-h-screen bg-background">
        <Section>
          <Container>
            <Card className="mx-auto max-w-lg">
              <CardHeader>
                <h1 className="font-display text-2xl font-medium">Access Restricted</h1>
                <CardDescription>
                  Admin Studio access is reserved for authorized staff and administrators.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/">Return to Storefront</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/account">My Account</Link>
                </Button>
              </CardContent>
            </Card>
          </Container>
        </Section>
      </main>
    );
  }

  return (
    <AdminShell
      siteName={settings.storeName}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-start justify-center bg-background p-6">
          <div className="w-full max-w-5xl space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      }
    >
      <AdminSessionGate>{children}</AdminSessionGate>
    </Suspense>
  );
}
