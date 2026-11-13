import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  label?: string;
  /** "list" = header + rows, "detail" = header + main/aside, "grid" = cards. */
  variant?: "list" | "detail" | "grid";
}

/** Generic route-level loading state used by loading.tsx files. */
export function PageSkeleton({ label = "Loading", variant = "list" }: PageSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-[70%]" />
        <Skeleton className="h-4 w-64 max-w-[85%]" />
      </div>

      {variant === "list" && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden h-8 w-20 sm:block" />
            </div>
          ))}
        </div>
      )}

      {variant === "detail" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      )}

      {variant === "grid" && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">{label}…</span>
    </div>
  );
}
