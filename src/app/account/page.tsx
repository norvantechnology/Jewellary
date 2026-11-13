import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gem, Heart, MapPin, Package, ShieldCheck, Sparkles } from "lucide-react";
import { RevealStagger } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { getAccountOverviewData } from "@/modules/account/account.service";
import { listCustomerCustomizationRequests } from "@/modules/customization/customization.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Account Overview",
};

// Signed-in page rendered per request; a blocking navigation is intended.
export const instant = false;

export default async function AccountOverviewPage() {
  const { user } = await requirePageUser("/account");
  const [overview, customizations] = await Promise.all([
    getAccountOverviewData(user.id),
    listCustomerCustomizationRequests({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      isStaff: false,
      guestToken: null,
      primaryOwnerKey: `user:${user.id}`,
      allOwnerKeys: [`user:${user.id}`],
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <RevealStagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Link
          href="/account/orders"
          className="ma-card-elevate rounded-xl border border-border bg-card p-3.5 focus-visible:outline-2 focus-visible:outline-foreground/45 md:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Orders</span>
            <Package className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
          </div>
          <p className="tabular-nums-price mt-1.5 text-2xl font-semibold text-foreground sm:mt-2.5 sm:text-3xl">
            {overview.orderCount}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
            Receipts &amp; tracking
          </p>
        </Link>

        <Link
          href="/account/addresses"
          className="ma-card-elevate rounded-xl border border-border bg-card p-3.5 focus-visible:outline-2 focus-visible:outline-foreground/45 md:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Addresses</span>
            <MapPin className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
          </div>
          <p className="tabular-nums-price mt-1.5 text-2xl font-semibold text-foreground sm:mt-2.5 sm:text-3xl">
            {overview.addressCount}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
            Shipping &amp; billing
          </p>
        </Link>

        <Link
          href="/account/customizations"
          className="ma-card-elevate rounded-xl border border-border bg-card p-3.5 focus-visible:outline-2 focus-visible:outline-foreground/45 md:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Custom Requests</span>
            <Sparkles className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
          </div>
          <p className="tabular-nums-price mt-1.5 text-2xl font-semibold text-foreground sm:mt-2.5 sm:text-3xl">
            {customizations.length}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
            Requests &amp; quotes
          </p>
        </Link>

        <Link
          href="/wishlist"
          className="ma-card-elevate rounded-xl border border-border bg-card p-3.5 focus-visible:outline-2 focus-visible:outline-foreground/45 md:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Wishlist</span>
            <Heart className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
          </div>
          <p className="tabular-nums-price mt-1.5 text-2xl font-semibold text-foreground sm:mt-2.5 sm:text-3xl">
            {overview.wishlistCount}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">Saved for later</p>
        </Link>
      </RevealStagger>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
            Recent Orders
          </h2>
          {overview.orderCount > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/orders" className="gap-1.5">
                <span>All Orders</span>
                <ArrowRight className="size-4 stroke-[1.5]" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>

        {overview.recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="Your orders and their tracking will appear here."
              actionLabel="Explore Collections"
              actionHref="/collections"
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {overview.recentOrders.map((order) => {
              const meta = ORDER_STATUS_META[order.status];
              return (
                <li key={order.id} className="py-4 first:pt-2 last:pb-0">
                  <Link
                    href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-4 rounded-md transition-colors duration-150 ease-out hover:text-accent-text focus-visible:outline-2 focus-visible:outline-foreground/45"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
                        {order.firstItemImage ? (
                          <Image
                            src={order.firstItemImage}
                            alt={order.firstItemTitle}
                            fill
                            sizes="44px"
                            className="object-cover object-center"
                          />
                        ) : (
                          <Gem className="size-4 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums-price text-base font-semibold text-foreground">
                            {order.orderNumber}
                          </span>
                          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                        </div>
                        <p className="tabular-nums-price mt-0.5 truncate text-xs text-muted-foreground">
                          {order.firstItemTitle}
                          {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : ""} ·{" "}
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="tabular-nums-price text-sm font-semibold text-foreground">
                      {formatMoneyExact(
                        order.total,
                        order.currency,
                        "en-US",
                        order.currencyDecimals,
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Default Delivery
            </h2>
            <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-9">
              <Link href="/account/addresses">Manage</Link>
            </Button>
          </div>
          {overview.defaultShippingAddress ? (
            <address className="mt-3 space-y-0.5 text-sm leading-relaxed break-words text-muted-foreground not-italic">
              <p className="font-semibold text-foreground">
                {overview.defaultShippingAddress.fullName}
              </p>
              <p>{overview.defaultShippingAddress.line1}</p>
              {overview.defaultShippingAddress.line2 && (
                <p>{overview.defaultShippingAddress.line2}</p>
              )}
              <p>
                {overview.defaultShippingAddress.city}, {overview.defaultShippingAddress.state}{" "}
                {overview.defaultShippingAddress.postalCode}
              </p>
              <p>{formatCountryName(overview.defaultShippingAddress.country)}</p>
            </address>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No default delivery address saved yet.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Account Security
            </h2>
            <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-9">
              <Link href="/account/settings">Settings</Link>
            </Button>
          </div>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Email status</dt>
              <dd>
                <Badge variant={overview.profile.emailVerified ? "success" : "warning"}>
                  {overview.profile.emailVerified ? "Verified" : "Verification pending"}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Telephone</dt>
              <dd className="tabular-nums-price text-foreground">
                {overview.profile.phone ?? "Not provided"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck
              className="size-5 shrink-0 stroke-[1.5] text-accent-text"
              aria-hidden="true"
            />
            <span>Ordered as a guest? Use Track Order to find it.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
