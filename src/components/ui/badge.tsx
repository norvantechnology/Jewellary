import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase transition-ui",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-text",
        new: "border-border bg-surface text-text",
        signature:
          "border-accent/35 bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] text-accent-text",
        outline: "border-border-strong bg-surface text-accent-text",
        primary: "border-transparent bg-primary text-on-primary",
        success: "border-success/30 bg-success-bg text-success",
        warning: "border-warning/30 bg-warning-bg text-warning",
        destructive: "border-danger/30 bg-danger-bg text-danger",
        info: "border-info/30 bg-info-bg text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
