import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { ForgotPasswordForm } from "@/modules/auth/ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.auth.forgotPassword.seo, {
    pathname: "/forgot-password",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function ForgotPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [params, content] = await Promise.all([searchParams, getSiteContent()]);
  return (
    <ForgotPasswordForm
      nextUrl={sanitizeRedirectPath(params.next, "/account")}
      copy={content.pages.auth.forgotPassword}
    />
  );
}

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[360px] w-full max-w-md rounded-md" />}>
      <ForgotPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
