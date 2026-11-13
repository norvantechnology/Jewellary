"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import type { NewsletterStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/dates";
import type { AdminNewsletterSubscriberDTO } from "@/modules/newsletter/newsletter.service";

const STATUS_VARIANT: Record<NewsletterStatus, "success" | "warning" | "outline"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  UNSUBSCRIBED: "outline",
};

export function AdminNewsletterClient({
  subscribers,
}: {
  subscribers: AdminNewsletterSubscriberDTO[];
}) {
  if (subscribers.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No matching newsletter subscribers"
        description="Double opt-in subscribers appear here once clients enter their address in the storefront footer."
      />
    );
  }

  const columns: ResponsiveColumn<AdminNewsletterSubscriberDTO>[] = [
    {
      key: "email",
      hideOnMobileCard: true,
      header: "Email",
      cell: (row) => <span className="font-medium text-foreground">{row.email}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>,
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.source ?? "footer"}</span>
      ),
    },
    {
      key: "consented",
      header: "Consented",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.consentedAt)}</span>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.verifiedAt ? formatDate(row.verifiedAt) : "Pending"}
        </span>
      ),
    },
  ];

  return (
    <ResponsiveDataTable<AdminNewsletterSubscriberDTO>
      data={subscribers}
      columns={columns}
      keyExtractor={(row) => row.id}
      mobileTitle={(row) => (
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium break-all text-foreground">{row.email}</p>
          <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
        </div>
      )}
    />
  );
}
