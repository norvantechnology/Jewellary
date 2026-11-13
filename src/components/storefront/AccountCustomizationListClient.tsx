"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useUserCustomizationsRealtime } from "@/components/providers/useChatRealtime";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import type { CustomizationRequestSummaryDTO } from "@/modules/customization/customization.service";

const STATUS_BADGE_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "primary" | "success" | "warning" | "destructive" | "outline";
  }
> = {
  SUBMITTED: { label: "Submitted", variant: "outline" },
  IN_REVIEW: { label: "In Review", variant: "warning" },
  ACCEPTED: { label: "Quoted", variant: "primary" },
  ORDERED: { label: "Ordered", variant: "success" },
  REJECTED: { label: "Declined", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  EXPIRED: { label: "Expired", variant: "outline" },
};

interface AccountCustomizationListClientProps {
  initialRequests: CustomizationRequestSummaryDTO[];
  ownerKey: string;
}

/**
 * Customer account Customization Requests list with desktop table, mobile cards,
 * active currency quotes, and live WebSocket status updates.
 */
export function AccountCustomizationListClient({
  initialRequests,
  ownerKey,
}: AccountCustomizationListClientProps) {
  const { formatPrice } = useCurrency();
  const [requests, setRequests] = React.useState(initialRequests);

  const refreshList = React.useCallback(async () => {
    try {
      const res = await fetch("/api/customizations", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        data?: { items?: CustomizationRequestSummaryDTO[] };
      };
      if (Array.isArray(body.data?.items)) {
        setRequests(body.data.items);
      }
    } catch {
      // Non-blocking refresh
    }
  }, []);

  useUserCustomizationsRealtime({
    targetKey: ownerKey,
    enabled: Boolean(ownerKey),
    onCustomizationEvent: () => {
      void refreshList();
    },
  });

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No bespoke customization requests yet"
        description="Select Customize on any eligible piece to tailor precious metals, gemstone specifications, or bespoke engraving."
        actionLabel="Explore Collections"
        actionHref="/collections"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card List (< md) */}
      <div className="space-y-3 md:hidden">
        {requests.map((req) => {
          const meta = STATUS_BADGE_MAP[req.status] ?? {
            label: req.status,
            variant: "outline" as const,
          };
          return (
            <article key={req.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {req.productImageUrl ? (
                      <Image
                        src={req.productImageUrl}
                        alt={req.productName}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Sparkles className="size-4" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="tabular-nums-price text-xs font-semibold text-accent-text">
                      {req.requestNumber}
                    </p>
                    <h3 className="truncate font-serif text-base font-medium text-foreground">
                      {req.productName}
                    </h3>
                    <p className="tabular-nums-price text-xs text-muted-foreground">
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">
                    {req.quotedPriceBase ? "Quoted Price" : "Est. Range"}
                  </span>
                  <p className="tabular-nums-price font-semibold text-foreground">
                    {req.quotedPriceBase
                      ? formatPrice(req.quotedPriceBase)
                      : `${formatPrice(req.indicativeMinBase)} – ${formatPrice(req.indicativeMaxBase)}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="min-h-11 gap-1.5">
                  <Link href={`/account/customizations/${encodeURIComponent(req.id)}`}>
                    <span>View</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Piece</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Estimate / Quote</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((req) => {
              const meta = STATUS_BADGE_MAP[req.status] ?? {
                label: req.status,
                variant: "outline" as const,
              };
              return (
                <tr key={req.id} className="hover:bg-surface-2/40">
                  <td className="tabular-nums-price px-4 py-3 font-semibold text-foreground">
                    {req.requestNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {req.productImageUrl ? (
                          <Image
                            src={req.productImageUrl}
                            alt={req.productName}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Sparkles className="size-4" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-foreground">{req.productName}</span>
                    </div>
                  </td>
                  <td className="tabular-nums-price px-4 py-3 text-muted-foreground">
                    {formatDate(req.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </td>
                  <td className="tabular-nums-price px-4 py-3 font-medium text-foreground">
                    {req.quotedPriceBase
                      ? formatPrice(req.quotedPriceBase)
                      : `${formatPrice(req.indicativeMinBase)} – ${formatPrice(req.indicativeMaxBase)}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/account/customizations/${encodeURIComponent(req.id)}`}>
                        View
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
