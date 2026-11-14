import { UiText } from "@/components/shared/UiText";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Float } from "@/components/motion/Float";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  suggestions?: Array<{ label: string; href: string }>;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  suggestions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm sm:py-14",
        className,
      )}
    >
      {Icon && (
        <Float amplitude={6} duration={7} rotate={1.2}>
          <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-muted text-accent-text">
            <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </div>
        </Float>
      )}
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <p className="prose-limit mt-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button type="button" onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-5">
          <span className="text-xs font-medium text-muted-foreground">
            <UiText section="common" name="exploreInstead" />
          </span>
          {suggestions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-ui inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-xs font-medium text-text hover:border-border-strong hover:bg-surface-3"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
