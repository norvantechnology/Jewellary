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
import { useUiText } from "@/components/providers/UiTextProvider";
import { formatDate } from "@/lib/dates";
import type { CustomizationRequestSummaryDTO } from "@/modules/customization/customization.service";

// Status labels come from site-content.json → ui.account.customizationStatus.
const STATUS_VARIANTS: Record<
  string,
  "default" | "primary" | "success" | "warning" | "destructive" | "outline"
> = {
  SUBMITTED: "outline",
  IN_REVIEW: "warning",
  ACCEPTED: "primary",
  ORDERED: "success",
  REJECTED: "destructive",
  CANCELLED: "outline",
  EXPIRED: "outline",
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
  const ui = useUiText().account;
  const t = ui.customizations;
  const statusLabels = ui.customizationStatus;
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
        title={t.emptyTitle}
        description={t.emptyText}
        actionLabel={t.emptyAction}
        actionHref="/collections"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card List (< md) */}
      <div className="space-y-3 md:hidden">
        {requests.map((req) => {
          const meta = {
            label: (statusLabels as Record<string, string>)[req.status] ?? req.status,
            variant: STATUS_VARIANTS[req.status] ?? ("outline" as const),
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
                    {req.quotedPriceBase ? t.quotedPrice : t.estimatedRange}
                  </span>
                  <p className="tabular-nums-price font-semibold text-foreground">
                    {req.quotedPriceBase
                      ? formatPrice(req.quotedPriceBase)
                      : `${formatPrice(req.indicativeMinBase)} – ${formatPrice(req.indicativeMaxBase)}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="min-h-11 gap-1.5">
                  <Link href={`/account/customizations/${encodeURIComponent(req.id)}`}>
                    <span>{t.view}</span>
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
              <th className="px-4 py-3">{t.columns.request}</th>
              <th className="px-4 py-3">{t.columns.piece}</th>
              <th className="px-4 py-3">{t.columns.submitted}</th>
              <th className="px-4 py-3">{t.columns.status}</th>
              <th className="px-4 py-3">{t.columns.estimate}</th>
              <th className="px-4 py-3 text-right">{t.columns.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((req) => {
              const meta = {
                label: (statusLabels as Record<string, string>)[req.status] ?? req.status,
                variant: STATUS_VARIANTS[req.status] ?? ("outline" as const),
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
                        {" "}
                        {t.view}{" "}
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
