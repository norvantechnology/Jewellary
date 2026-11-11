import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart, MapPin, Package, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCountryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatMoneyExact } from "@/lib/money";
import { getAccountOverviewData } from "@/modules/account/account.service";
import { ORDER_STATUS_META } from "@/modules/orders/state-machine";
import { requirePageUser } from "@/server/dal";

export const metadata: Metadata = {
  title: "Account Overview",
};

export default async function AccountOverviewPage() {
  const { user } = await requirePageUser("/account");
  const overview = await getAccountOverviewData(user.id);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/account/orders"
          className="rounded-md border border-border bg-card p-5 transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-editorial-label text-muted-foreground">
              Commissions
            </span>
            <Package className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-medium text-foreground tabular-nums-price">
            {overview.orderCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">View receipts &amp; courier tracking</p>
        </Link>

        <Link
          href="/account/addresses"
          className="rounded-md border border-border bg-card p-5 transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-editorial-label text-muted-foreground">
              Saved Addresses
            </span>
            <MapPin className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-medium text-foreground tabular-nums-price">
            {overview.addressCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Shipping &amp; billing destinations</p>
        </Link>

        <Link
          href="/wishlist"
          className="rounded-md border border-border bg-card p-5 transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-editorial-label text-muted-foreground">Wishlist</span>
            <Heart className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-medium text-foreground tabular-nums-price">
            {overview.wishlistCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Curated pieces saved for later</p>
        </Link>
      </div>

      <section className="rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-medium text-foreground">Recent Commissions</h2>
          {overview.orderCount > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/orders">
                All Orders <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>

        {overview.recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Package}
              title="No commissions placed yet"
              description="Once you reserve a piece, its atelier inspection progress and courier waybill appear here."
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
                    className="flex flex-wrap items-center justify-between gap-4 rounded-sm transition-colors hover:text-accent-text"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-medium text-foreground">
                          {order.orderNumber}
                        </span>
                        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.firstItemTitle}
                        {order.itemCount > 1 ? ` + ${order.itemCount - 1} more` : ""} ·{" "}
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <p className="font-medium text-foreground tabular-nums-price">
                      {formatMoneyExact(order.total, order.currency)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium text-foreground">Default Delivery</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/addresses">Manage</Link>
            </Button>
          </div>
          {overview.defaultShippingAddress ? (
            <address className="mt-3 space-y-0.5 text-sm text-muted-foreground not-italic">
              <p className="font-medium text-foreground">
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

        <section className="rounded-md border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium text-foreground">Account Protection</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/settings">Settings</Link>
            </Button>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
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
              <dd className="text-foreground">{overview.profile.phone ?? "Not provided"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
            <span>Track guest orders anytime via the concierge lookup page.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
