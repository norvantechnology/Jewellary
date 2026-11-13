import { Skeleton } from "@/components/ui/skeleton";

export default function AccountOrdersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading orders">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="divide-y divide-border p-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card skeleton */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
