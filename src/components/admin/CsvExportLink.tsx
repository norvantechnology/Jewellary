import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CsvExportLinkProps {
  resource: "orders" | "products" | "inventory" | "customers";
  label?: string;
}

/**
 * Shared CSV export trigger for admin resources.
 * Uses a native `<a download>` rather than `next/link` because `/api/admin/export/*`
 * responds with `Content-Disposition: attachment` instead of a Next.js App Router page.
 */
export function CsvExportLink({ resource, label = "Export CSV" }: CsvExportLinkProps) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/admin/export/${resource}`} download>
        <Download className="mr-1.5 size-4" aria-hidden="true" />
        <span>{label}</span>
      </a>
    </Button>
  );
}
