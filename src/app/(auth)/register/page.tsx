import { Suspense } from "react";
import type { Metadata } from "next";
import { NOINDEX_NOFOLLOW_ROBOTS } from "@/lib/seo/metadata";
import { buildPageMetadata, getSiteContent } from "@/modules/site-content/site-content.service";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { RegisterForm } from "@/modules/auth/RegisterForm";
import { isGoogleAuthEnabled } from "@/server/auth";
import { getOptionalSession } from "@/server/dal";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata((c) => c.pages.auth.register.seo, {
    pathname: "/register",
    robots: NOINDEX_NOFOLLOW_ROBOTS,
  });
}

async function RegisterContent({
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
    <RegisterForm
      nextUrl={nextUrl}
      googleEnabled={isGoogleAuthEnabled}
      copy={content.pages.auth.register}
    />
  );
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[580px] w-full max-w-md rounded-md" />}>
      <RegisterContent searchParams={searchParams} />
    </Suspense>
  );
}
