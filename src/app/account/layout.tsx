import { Suspense } from "react";
import type { Metadata } from "next";
import { getRequestReturnTo } from "@/server/return-to";
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
    redirect(`/login?next=${encodeURIComponent(await getRequestReturnTo("/account"))}`);
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

// Signed-in area: every page is rendered per request behind an auth check, so blocking is intended.
export const instant = false;

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <div className="container-default space-y-6 py-12">
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
