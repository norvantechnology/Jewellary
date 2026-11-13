import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "transition-ui flex min-h-24 w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20 md:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
