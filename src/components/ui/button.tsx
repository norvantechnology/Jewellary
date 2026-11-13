import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans text-sm font-medium transition-ui focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 [&_svg]:shrink-0 cursor-pointer select-none touch-manipulation",
  {
    variants: {
      variant: {
        primary:
          "ma-btn ma-btn-sheen bg-primary text-on-primary shadow-sm hover:bg-primary-hover active:bg-primary-hover/95",
        accent:
          "ma-btn ma-btn-sheen bg-accent text-on-accent shadow-sm hover:bg-accent-hover active:bg-accent-hover",
        secondary:
          "ma-btn border border-border-strong bg-surface-2 text-text hover:bg-surface-3 hover:border-text-2 active:bg-surface-3",
        outline:
          "ma-btn border border-border-strong bg-transparent text-text hover:bg-surface-2 hover:border-text-2 active:bg-surface-2",
        ghost: "ma-btn text-text-2 hover:bg-surface-3 hover:text-text active:bg-surface-3",
        link: "text-accent-text underline-offset-4 hover:text-accent-hover hover:underline active:opacity-80 px-1 py-2 h-auto min-h-11",
        destructive:
          "ma-btn bg-danger text-danger-foreground shadow-sm hover:bg-danger/90 active:bg-danger/85",
      },
      size: {
        sm: "min-h-11 px-3.5 py-2 text-sm",
        md: "min-h-11 px-5 py-2.5 text-sm",
        lg: "min-h-11 px-5 py-2.5 text-[15px] sm:min-h-12 sm:px-7 sm:py-3 sm:text-base",
        icon: "size-11 min-w-11 min-h-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Slot.Root>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  "aria-label": string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "ghost", className, ...props }, ref) => {
    return <Button ref={ref} variant={variant} size="icon" className={className} {...props} />;
  },
);
IconButton.displayName = "IconButton";

export { buttonVariants };
