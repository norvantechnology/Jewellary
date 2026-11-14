"use client";

import { LocalDate } from "@/components/shared/LocalDate";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { Price } from "@/components/shared/Price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CustomizationRequestSummaryDTO } from "@/modules/customization/customization.service";

interface AdminCustomizationsClientProps {
  initialData: {
    items: CustomizationRequestSummaryDTO[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: {
    status: string;
    search: string;
    sort: string;
    dateFrom: string;
    dateTo: string;
  };
}

const STATUS_BADGE_MAP: Record<
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

export function AdminCustomizationsClient({
  initialData,
  filters,
}: AdminCustomizationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(filters.search);
  const [status, setStatus] = React.useState(filters.status);
  const [sort, setSort] = React.useState(filters.sort);
  const [dateFrom, setDateFrom] = React.useState(filters.dateFrom);
  const [dateTo, setDateTo] = React.useState(filters.dateTo);

  function pushQuery(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    if (status && status !== "ALL") params.set("status", status);
    else params.delete("status");
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    if (sort && sort !== "newest") params.set("sort", sort);
    else params.delete("sort");
    if (dateFrom) params.set("dateFrom", dateFrom);
    else params.delete("dateFrom");
    if (dateTo) params.set("dateTo", dateTo);
    else params.delete("dateTo");
    params.set("page", String(nextPage));
    router.push(`/admin/customizations?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Customization Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review custom requests, adjust details, send quotes, and message collectors.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {initialData.totalCount} {initialData.totalCount === 1 ? "request" : "requests"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushQuery(1);
            }}
            className="grid gap-3 md:grid-cols-6"
          >
            <div className="relative md:col-span-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, email, customer, product…"
                aria-label="Search customization requests"
                className="pl-9 text-base sm:text-sm"
              />
            </div>

            <NativeSelect
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="ACCEPTED">Accepted (Quoted)</option>
              <option value="ORDERED">Ordered</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </NativeSelect>

            <NativeSelect
              aria-label="Sort requests"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="quoted_high">Quote High → Low</option>
              <option value="expiring_soon">Expiring Soon</option>
            </NativeSelect>

            <Input
              type="date"
              aria-label="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <div className="flex gap-2">
              <Input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <Button type="submit" className="min-h-10 shrink-0">
                Apply
              </Button>
            </div>
          </form>
        </CardHeader>

        <CardContent>
          {initialData.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                No customization requests match these filters.
              </p>
              <p className="text-xs text-muted-foreground">
                Try clearing search terms or expanding date bounds.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                      <th className="py-3 pr-3 font-medium">Request</th>
                      <th className="py-3 pr-3 font-medium">Piece</th>
                      <th className="py-3 pr-3 font-medium">Collector</th>
                      <th className="py-3 pr-3 font-medium">Status</th>
                      <th className="py-3 pr-3 font-medium">Estimate / Quote</th>
                      <th className="py-3 pr-3 font-medium">Submitted</th>
                      <th className="py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {initialData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-foreground">
                          <Link
                            href={`/admin/customizations/${item.id}`}
                            className="hover:text-accent-text hover:underline"
                          >
                            {item.requestNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            {item.productImageUrl ? (
                              <div className="relative size-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
                                <Image
                                  src={item.productImageUrl}
                                  alt={item.productName}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                            ) : null}
                            <div className="min-w-0">
                              <p className="max-w-xs truncate font-medium text-foreground">
                                {item.productName}
                              </p>
                              <p className="text-xs text-muted-foreground">SKU {item.productSku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-foreground">{item.customerName}</p>
                          <p className="text-xs text-muted-foreground">{item.customerEmail}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant={STATUS_BADGE_MAP[item.status] ?? "outline"}>
                            {item.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="tabular-nums-price py-3 pr-3 text-xs">
                          {item.quotedPriceBase ? (
                            <span className="font-semibold text-foreground">
                              <Price amount={item.quotedPriceBase} exact />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Est. <Price amount={item.indicativeMinBase} /> –{" "}
                              <Price amount={item.indicativeMaxBase} />
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          <LocalDate value={item.createdAt} />
                        </td>
                        <td className="py-3 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/customizations/${item.id}`}>Review</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {initialData.items.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-2.5 rounded-lg border border-border bg-background/60 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {item.requestNumber}
                        </p>
                        <p className="text-sm font-medium text-foreground">{item.productName}</p>
                      </div>
                      <Badge variant={STATUS_BADGE_MAP[item.status] ?? "outline"}>
                        {item.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.customerName} · {item.customerEmail}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-foreground">
                        {item.quotedPriceBase ? (
                          <Price amount={item.quotedPriceBase} exact />
                        ) : (
                          <>
                            Est. <Price amount={item.indicativeMinBase} /> –{" "}
                            <Price amount={item.indicativeMaxBase} />
                          </>
                        )}
                      </span>
                      <Button asChild size="sm" className="min-h-10">
                        <Link href={`/admin/customizations/${item.id}`}>Open Detail</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>
                  Page {initialData.page} of {initialData.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={initialData.page <= 1}
                    onClick={() => pushQuery(initialData.page - 1)}
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={initialData.page >= initialData.totalPages}
                    onClick={() => pushQuery(initialData.page + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
