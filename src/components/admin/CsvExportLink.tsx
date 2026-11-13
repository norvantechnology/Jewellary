import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CsvExportLinkProps {
  resource: "orders" | "products" | "inventory" | "customers" | "newsletter";
  label?: string;
  query?: string;
}

/**
 * Shared CSV export trigger for admin resources.
 * Uses a native `<a download>` rather than `next/link` because `/api/admin/export/*`
 * responds with `Content-Disposition: attachment` instead of a Next.js App Router page.
 */
export function CsvExportLink({ resource, label = "Export CSV", query }: CsvExportLinkProps) {
  const href = query ? `/api/admin/export/${resource}?${query}` : `/api/admin/export/${resource}`;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        <Download className="mr-1.5 size-4" aria-hidden="true" />
        <span>{label}</span>
      </a>
    </Button>
  );
}
