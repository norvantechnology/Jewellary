import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { LoginForm } from "@/modules/auth/LoginForm";
import { isGoogleAuthEnabled } from "@/server/auth";
import { getOptionalSession } from "@/server/dal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.auth.login.seo, {
    pathname: "/login",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeRedirectPath(params.next, "/account");
  const [session, content] = await Promise.all([getOptionalSession(), getSiteContent()]);
  if (session) {
    redirect(nextUrl);
  }

  return (
    <LoginForm
      nextUrl={nextUrl}
      googleEnabled={isGoogleAuthEnabled}
      copy={content.pages.auth.login}
    />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[460px] w-full max-w-md rounded-md" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
