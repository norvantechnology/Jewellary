import * as React from "react";
import { cn } from "@/lib/utils";

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "transition-ui flex h-12 min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 aria-[invalid=true]:border-danger md:h-11 md:min-h-11 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
NativeSelect.displayName = "NativeSelect";
