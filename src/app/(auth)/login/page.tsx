import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { LoginForm } from "@/modules/auth/LoginForm";
import { isGoogleAuthEnabled } from "@/server/auth";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Access your account, wishlist, saved addresses, and insured orders.",
};

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeRedirectPath(params.next, "/account");
  const session = await getOptionalSession();
  if (session) {
    redirect(nextUrl);
  }

  return <LoginForm nextUrl={nextUrl} googleEnabled={isGoogleAuthEnabled} />;
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
