import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifyEmailPanel } from "@/modules/auth/VerifyEmailPanel";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.auth.verifyEmail.seo, {
    pathname: "/verify-email",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [params, content] = await Promise.all([searchParams, getSiteContent()]);
  const token = typeof params.token === "string" ? params.token : null;
  return <VerifyEmailPanel token={token} copy={content.pages.auth.verifyEmail.card} />;
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[320px] w-full max-w-md rounded-md" />}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
