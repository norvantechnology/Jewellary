import { formatMoney, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceProps {
  amount?: MoneyInput | null;
  compareAtAmount?: MoneyInput | null;
  currency?: string;
  locale?: string;
  isPriceOnRequest?: boolean;
  prefix?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Price({
  amount,
  compareAtAmount,
  currency = "USD",
  locale = "en-US",
  isPriceOnRequest = false,
  prefix,
  className,
  size = "md",
}: PriceProps) {
  if (isPriceOnRequest || amount === null || amount === undefined) {
    return (
      <span
        className={cn(
          "font-sans text-sm font-medium tracking-wide text-accent-text uppercase",
          className,
        )}
      >
        Price upon request
      </span>
    );
  }

  const sizeClass =
    size === "lg" ? "text-2xl font-medium" : size === "sm" ? "text-sm" : "text-base font-medium";

  const showCompare =
    compareAtAmount !== null &&
    compareAtAmount !== undefined &&
    Number(compareAtAmount.toString()) > Number(amount.toString());

  return (
    <span
      className={cn("inline-flex flex-wrap items-baseline gap-2 tabular-nums-price", className)}
    >
      {prefix && <span className="text-xs font-normal text-muted-foreground">{prefix}</span>}
      <span className={cn("text-foreground", sizeClass)}>
        {formatMoney(amount, currency, locale)}
      </span>
      {showCompare && (
        <span className="text-sm text-muted-foreground line-through">
          {formatMoney(compareAtAmount, currency, locale)}
        </span>
      )}
    </span>
  );
}
