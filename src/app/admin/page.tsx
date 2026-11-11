import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container, Section } from "@/components/shared/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roleAtLeast } from "@/lib/permissions";
import { SignOutButton } from "@/modules/auth/SignOutButton";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Admin Studio",
  robots: { index: false, follow: false },
};

async function AdminGuardView() {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/login?next=/admin");
  }

  if (!roleAtLeast(session.user.role, "STAFF")) {
    return (
      <Container>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              This area is restricted to authorized{" "}
              {session.user.role === "CUSTOMER" ? "staff and administrators" : "personnel"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/">Return to Storefront</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account">My Account</Link>
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Maison Operations</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Admin Studio</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="primary">{session.user.role}</Badge>
          <SignOutButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authenticated Staff Session</CardTitle>
          <CardDescription>
            Signed in as {session.user.name} ({session.user.email}) with verified RBAC role{" "}
            {session.user.role}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/collections">View Storefront</Link>
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}

export default function AdminPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <Section spacing="md">
        <Suspense
          fallback={
            <Container>
              <Skeleton className="h-48 w-full rounded-md" />
            </Container>
          }
        >
          <AdminGuardView />
        </Suspense>
      </Section>
    </main>
  );
}
