"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import dynamic from "next/dynamic";
import { useOptionalCurrency } from "@/components/providers/CurrencyProvider";
import { getCurrencyExponent } from "@/lib/money";
import { formatMoney, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

const LazyAnimatedCounter = dynamic(() =>
  import("@/components/motion/AnimatedCounter").then((m) => m.AnimatedCounter),
);

interface PriceProps {
  amount?: MoneyInput | null;
  compareAtAmount?: MoneyInput | null;
  currency?: string;
  locale?: string;
  isPriceOnRequest?: boolean;
  /**
   * Set true when amount is ALREADY converted to a specific order/transaction currency
   * and must never be re-converted dynamically.
   */
  alreadyConverted?: boolean;
  currencyDecimals?: number;
  exact?: boolean;
  prefix?: string;
  animate?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Price({
  amount,
  compareAtAmount,
  currency = "USD",
  locale = "en-US",
  isPriceOnRequest = false,
  alreadyConverted = false,
  currencyDecimals,
  exact = false,
  prefix,
  animate = false,
  className,
  size = "md",
}: PriceProps) {
  const ui = useUiText();
  const currencyCtx = useOptionalCurrency();

  if (isPriceOnRequest || amount === null || amount === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-sans text-sm font-medium text-accent-text",
          className,
        )}
      >
        {ui.common.priceOnRequest}
      </span>
    );
  }

  const sizeClass =
    size === "lg"
      ? "text-2xl sm:text-[1.75rem] lg:text-[2rem] leading-tight font-semibold"
      : size === "sm"
        ? "text-sm font-medium"
        : "text-base sm:text-lg font-semibold";

  const showCompare =
    compareAtAmount !== null &&
    compareAtAmount !== undefined &&
    Number(compareAtAmount.toString()) > Number(amount.toString());

  const renderAmount = (val: MoneyInput) => {
    if (alreadyConverted) {
      const dp = currencyDecimals ?? getCurrencyExponent(currency);
      return formatMoney(val, currency, locale, dp);
    }
    if (currencyCtx) {
      return currencyCtx.formatPrice(val, { locale, exact });
    }
    return formatMoney(val, currency, locale, currencyDecimals);
  };

  return (
    <span
      className={cn("tabular-nums-price inline-flex flex-wrap items-baseline gap-2", className)}
    >
      {prefix && <span className="text-xs font-normal text-muted-foreground">{prefix}</span>}
      {animate ? (
        <LazyAnimatedCounter
          value={renderAmount(amount)}
          className={cn("text-foreground", sizeClass)}
        />
      ) : (
        <span className={cn("text-foreground", sizeClass)}>{renderAmount(amount)}</span>
      )}
      {showCompare && (
        <span className="text-sm text-muted-foreground line-through">
          {renderAmount(compareAtAmount)}
        </span>
      )}
    </span>
  );
}
