import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { RegisterForm } from "@/modules/auth/RegisterForm";
import { isGoogleAuthEnabled } from "@/server/auth";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register to save pieces, track orders, and store insured shipping addresses.",
};

async function RegisterContent({
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

  return <RegisterForm nextUrl={nextUrl} googleEnabled={isGoogleAuthEnabled} />;
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
