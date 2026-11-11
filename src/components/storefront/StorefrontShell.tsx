import { Suspense } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HeaderSearchBar } from "@/components/storefront/HeaderSearchBar";
import {
  HeaderCartAction,
  HeaderWishlistAction,
} from "@/components/storefront/StorefrontHeaderActions";
import { VisitorStateHydrator } from "@/components/storefront/VisitorStateHydrator";
import { getCurrentCartSummary } from "@/modules/cart/cart.service";
import { getSiteHeaderConfig } from "@/modules/settings/settings.service";
import { getCurrentWishlistState } from "@/modules/wishlist/wishlist.service";
import { getOptionalSession } from "@/server/dal";

async function AsyncWishlistHeaderSlot() {
  const [wishlist, cart] = await Promise.all([getCurrentWishlistState(), getCurrentCartSummary()]);
  return (
    <>
      <VisitorStateHydrator wishlistVariantIds={wishlist.variantIds} bagCount={cart.itemCount} />
      <HeaderWishlistAction initialCount={wishlist.count} />
    </>
  );
}

async function AsyncCartHeaderSlot() {
  const cart = await getCurrentCartSummary();
  return <HeaderCartAction initialCount={cart.itemCount} />;
}

async function AsyncAccountHeaderSlot() {
  const session = await getOptionalSession();
  const user = session?.user;
  const href = !user
    ? "/login"
    : user.role === "ADMIN" || user.role === "STAFF"
      ? "/admin"
      : "/account";
  const label = !user
    ? "Sign in"
    : user.role === "ADMIN" || user.role === "STAFF"
      ? "Admin Studio"
      : `Account (${user.name})`;

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <User className="size-4" aria-hidden="true" />
    </Link>
  );
}

export async function StorefrontShell({ children }: { children: React.ReactNode }) {
  const headerConfig = await getSiteHeaderConfig();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header
        config={headerConfig}
        searchSlot={<HeaderSearchBar />}
        wishlistCountSlot={
          <Suspense fallback={<HeaderWishlistAction initialCount={0} />}>
            <AsyncWishlistHeaderSlot />
          </Suspense>
        }
        cartTriggerSlot={
          <Suspense fallback={<HeaderCartAction initialCount={0} />}>
            <AsyncCartHeaderSlot />
          </Suspense>
        }
        accountLinkSlot={
          <Suspense
            fallback={
              <Link
                href="/login"
                aria-label="Account"
                className="inline-flex size-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
              >
                <User className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            <AsyncAccountHeaderSlot />
          </Suspense>
        }
      />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer config={headerConfig} />
    </div>
  );
}
