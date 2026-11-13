import * as React from "react";
import { cn } from "@/lib/utils";

export type ContainerVariant = "default" | "wide" | "prose";

const containerVariantClasses: Record<ContainerVariant, string> = {
  wide: "container-wide",
  default: "container-default",
  prose: "container-prose",
};

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ContainerVariant;
}

export function Container({ variant = "default", className, children, ...props }: ContainerProps) {
  return (
    <div className={cn(containerVariantClasses[variant], className)} {...props}>
      {children}
    </div>
  );
}

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}

const stackGaps: Record<NonNullable<StackProps["gap"]>, string> = {
  xs: "gap-1.5",
  sm: "gap-3",
  md: "gap-5",
  lg: "gap-8",
  xl: "gap-12",
};

export function Stack({ gap = "md", className, children, ...props }: StackProps) {
  return (
    <div className={cn("flex flex-col", stackGaps[gap], className)} {...props}>
      {children}
    </div>
  );
}

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
}

const gridCols: Record<NonNullable<GridProps["cols"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

export function Grid({ cols = 3, className, children, ...props }: GridProps) {
  return (
    <div className={cn("grid gap-3 sm:gap-4 lg:gap-6", gridCols[cols], className)} {...props}>
      {children}
    </div>
  );
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: "sm" | "md" | "lg";
}

const sectionSpacing: Record<NonNullable<SectionProps["spacing"]>, string> = {
  sm: "py-6 md:py-12 lg:py-16",
  md: "py-10 md:py-[4.5rem] lg:py-24",
  lg: "py-10 md:py-[4.5rem] lg:py-24",
};

export function Section({ spacing = "md", className, children, ...props }: SectionProps) {
  return (
    <section className={cn(sectionSpacing[spacing], className)} {...props}>
      {children}
    </section>
  );
}

export type ProductGridVariant = "catalog" | "default";

export function getProductGridClassName(
  variant: ProductGridVariant = "default",
  className?: string,
) {
  return cn(variant === "catalog" ? "product-grid-catalog" : "product-grid-default", className);
}

interface ProductGridProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ProductGridVariant;
}

export function ProductGrid({
  variant = "default",
  className,
  children,
  ...props
}: ProductGridProps) {
  return (
    <div className={getProductGridClassName(variant, className)} {...props}>
      {children}
    </div>
  );
}
