import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobileCard?: boolean;
}

interface ResponsiveDataTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (item: T) => string;
  emptyState?: React.ReactNode;
  mobileTitle?: (item: T) => React.ReactNode;
  className?: string;
}

export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  mobileTitle,
  className,
}: ResponsiveDataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop & tablet table */}
      <div className="hidden rounded-md border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={keyExtractor(item)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (UX-30 / AD-01) */}
      <div className="grid gap-3 md:hidden">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="rounded-md border border-border bg-card p-4 shadow-soft"
          >
            {mobileTitle && (
              <div className="mb-3 border-b border-border pb-2.5 font-medium text-foreground">
                {mobileTitle(item)}
              </div>
            )}
            <dl className="grid min-w-0 gap-2 text-sm">
              {columns
                .filter((col) => !col.hideOnMobileCard)
                .map((col) => (
                  <div key={col.key} className="flex min-w-0 items-start justify-between gap-4">
                    <dt className="shrink-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {col.header}
                    </dt>
                    <dd className="min-w-0 flex-1 text-right break-words text-foreground">
                      {col.cell(item)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
