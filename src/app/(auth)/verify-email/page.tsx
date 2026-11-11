import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifyEmailPanel } from "@/modules/auth/VerifyEmailPanel";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Confirm your email address or request a fresh verification link.",
};

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  return <VerifyEmailPanel token={token} />;
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
