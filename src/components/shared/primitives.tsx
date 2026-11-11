import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("container-page", className)} {...props}>
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
    <div className={cn("grid gap-5 md:gap-7", gridCols[cols], className)} {...props}>
      {children}
    </div>
  );
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: "sm" | "md" | "lg";
}

const sectionSpacing: Record<NonNullable<SectionProps["spacing"]>, string> = {
  sm: "py-8 md:py-12",
  md: "py-12 md:py-18",
  lg: "py-16 md:py-24",
};

export function Section({ spacing = "md", className, children, ...props }: SectionProps) {
  return (
    <section className={cn(sectionSpacing[spacing], className)} {...props}>
      {children}
    </section>
  );
}
