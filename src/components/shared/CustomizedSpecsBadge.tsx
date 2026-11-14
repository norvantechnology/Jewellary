"use client";

import Link from "next/link";
import { useUiText } from "@/components/providers/UiTextProvider";
import { Sparkles } from "lucide-react";

interface CustomizedSpecsBadgeProps {
  requestId?: string | null;
  requestNumber?: string | null;
  summaryLines?: Array<{ label: string; value: string }>;
  hrefBase?: "/account/customizations" | "/admin/customizations";
  /** One short line ("Custom · 3 specs") for tight lists such as the checkout summary. */
  compact?: boolean;
}

export function CustomizedSpecsBadge({
  requestId,
  requestNumber,
  summaryLines = [],
  hrefBase = "/account/customizations",
  compact = false,
}: CustomizedSpecsBadgeProps) {
  const ui = useUiText();
  if (!requestId && summaryLines.length === 0) {
    return null;
  }

  if (compact) {
    const preview = summaryLines
      .slice(0, 2)
      .map((line) => line.value)
      .join(" · ");
    return (
      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
        <span className="shrink-0 font-medium text-foreground">{ui.common.customBadge}</span>
        {preview ? <span className="truncate">· {preview}</span> : null}
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/50 px-2.5 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
        <Sparkles className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
        <span>{ui.common.customSpecifications}</span>
        {requestId && requestNumber ? (
          <Link
            href={`${hrefBase}/${encodeURIComponent(requestId)}`}
            className="underline decoration-border underline-offset-2 hover:text-accent-text"
          >
            {requestNumber}
          </Link>
        ) : requestNumber ? (
          <span className="text-muted-foreground">{requestNumber}</span>
        ) : null}
      </div>
      {summaryLines.length > 0 ? (
        <dl className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
          {summaryLines.slice(0, 6).map((line) => (
            <div key={line.label} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-muted-foreground">{line.label}:</dt>
              <dd className="truncate font-medium text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
