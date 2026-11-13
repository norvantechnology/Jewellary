import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";
import { ForgotPasswordForm } from "@/modules/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request password reset instructions for your account.",
};

async function ForgotPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return <ForgotPasswordForm nextUrl={sanitizeRedirectPath(params.next, "/account")} />;
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
