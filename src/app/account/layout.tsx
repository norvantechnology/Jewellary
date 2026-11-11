import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/storefront/AccountShell";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptionalSession } from "@/server/dal";

export const metadata: Metadata = {
  title: {
    default: "My Account",
    template: "%s | Client Account",
  },
  robots: { index: false, follow: false },
};

async function AccountSessionGate({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/login?next=/account");
  }

  return (
    <AccountShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    >
      {children}
    </AccountShell>
  );
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
            <Skeleton className="h-16 w-64" />
            <div className="grid gap-6 lg:grid-cols-12">
              <Skeleton className="h-64 lg:col-span-3" />
              <Skeleton className="h-96 lg:col-span-9" />
            </div>
          </div>
        }
      >
        <AccountSessionGate>{children}</AccountSessionGate>
      </Suspense>
    </StorefrontShell>
  );
}
