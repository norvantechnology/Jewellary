import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteContentEditor } from "@/components/admin/SiteContentEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission } from "@/lib/permissions";
import { getEditableSiteContent } from "@/modules/site-content/site-content.service";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Page Content",
};

// Rendered per request (signed-in); a blocking navigation is intended.
export const instant = false;

async function ContentEditorBody() {
  const session = await getOptionalSession();
  if (!session || !hasPermission(session.user.role, "content:manage")) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <h1 className="font-display text-2xl font-medium">Content Access Required</h1>
          <CardDescription>Your role cannot edit storefront page content.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin">Back to overview</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const { content, hasOverride, updatedAt } = await getEditableSiteContent();
  return (
    <SiteContentEditor initialContent={content} hasOverride={hasOverride} updatedAt={updatedAt} />
  );
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <ContentEditorBody />
    </Suspense>
  );
}
