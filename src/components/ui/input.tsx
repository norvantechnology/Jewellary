import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "transition-ui flex h-12 min-h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 py-2 text-base text-text file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20 md:h-11 md:min-h-11 md:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
