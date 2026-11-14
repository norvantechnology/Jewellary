import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordForm } from "@/modules/auth/ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.auth.resetPassword.seo, {
    pathname: "/reset-password",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [params, content] = await Promise.all([searchParams, getSiteContent()]);
  const token = typeof params.token === "string" ? params.token : null;
  return <ResetPasswordForm token={token} copy={content.pages.auth.resetPassword} />;
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[360px] w-full max-w-md rounded-md" />}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
