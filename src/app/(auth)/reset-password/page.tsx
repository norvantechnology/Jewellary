import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordForm } from "@/modules/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your account.",
};

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  return <ResetPasswordForm token={token} />;
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
