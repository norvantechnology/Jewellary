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
  title: "My Account",
  robots: { index: false, follow: false },
};

async function AccountOverview() {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/login?next=/account");
  }

  const { user } = session;

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Client Dossier</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground sm:text-4xl">
            {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={user.emailVerified ? "success" : "warning"}>
            {user.emailVerified ? "Email Verified" : "Verification Pending"}
          </Badge>
          {roleAtLeast(user.role, "STAFF") && (
            <Button asChild variant="secondary">
              <Link href="/admin">Admin Studio</Link>
            </Button>
          )}
          <SignOutButton />
        </div>
      </div>

      {!user.emailVerified && (
        <div
          role="status"
          className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <span>Please verify your email address to protect your account and deliveries.</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/verify-email">Verify Now</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Account identity and contact preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {user.name}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">Role:</span> {user.role}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Wishlist</CardTitle>
            <CardDescription>Pieces saved for future consideration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/wishlist">View Wishlist</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Tracking</CardTitle>
            <CardDescription>Review insured shipment progress.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders/track">Track an Order</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default function AccountPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <Section spacing="md">
        <Suspense
          fallback={
            <Container>
              <Skeleton className="h-64 w-full rounded-md" />
            </Container>
          }
        >
          <AccountOverview />
        </Suspense>
      </Section>
    </main>
  );
}
