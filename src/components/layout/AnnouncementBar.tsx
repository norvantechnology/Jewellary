"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useOptionalCurrency } from "@/components/providers/CurrencyProvider";
import { MOTION_EASE, useReducedMotionSafe } from "@/lib/motion";
import { formatPrice } from "@/lib/currency";
import { formatMoney, formatMoneyExact } from "@/lib/money";

interface AnnouncementBarProps {
  text?: string | null;
  href?: string | null;
  enabled?: boolean;
  freeShippingThreshold?: string | null;
  baseCurrency?: string;
}

const DISMISS_KEY = "ma_announcement_dismissed";
const EVENT_NAME = "ma:announcement-dismissed";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

function getClientSnapshot() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function AnnouncementBar({
  text,
  href,
  enabled = true,
  freeShippingThreshold,
  baseCurrency = "USD",
}: AnnouncementBarProps) {
  const dismissed = React.useSyncExternalStore(subscribe, getClientSnapshot, () => false);
  const currencyCtx = useOptionalCurrency();

  const resolvedText = React.useMemo(() => {
    if (!text) return text;
    if (!freeShippingThreshold) return text;

    const formattedTarget = currencyCtx
      ? currencyCtx.formatPrice(freeShippingThreshold)
      : formatPrice(freeShippingThreshold, {
          code: baseCurrency,
          symbol: "$",
          symbolPosition: "BEFORE",
          decimalPlaces: 2,
          roundingRule: "HALF_UP",
          exchangeRate: "1",
        });

    if (text.includes("{{freeShippingThreshold}}")) {
      return text.replaceAll("{{freeShippingThreshold}}", formattedTarget);
    }

    const baseCompact = formatMoney(freeShippingThreshold, baseCurrency);
    const baseExact = formatMoneyExact(freeShippingThreshold, baseCurrency);
    let updated = text;
    if (baseExact && updated.includes(baseExact)) {
      updated = updated.replaceAll(baseExact, formattedTarget);
    } else if (baseCompact && updated.includes(baseCompact)) {
      updated = updated.replaceAll(baseCompact, formattedTarget);
    }
    return updated;
  }, [text, freeShippingThreshold, baseCurrency, currencyCtx]);

  const reducedMotion = useReducedMotionSafe();
  const visible = Boolean(enabled && resolvedText && !dismissed);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // Ignore storage failures
    }
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <m.div
          data-focus-hide=""
          key="announcement-bar"
          initial={false}
          exit={reducedMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.18, ease: MOTION_EASE.out }}
          className="relative z-[1] origin-top overflow-hidden border-b border-announce-border bg-announce-bg text-announce-text"
        >
          <div className="container-wide">
            <div className="relative flex min-h-11 items-center justify-center px-11 py-1.5 text-center text-xs leading-snug sm:h-11 sm:px-14 sm:py-0 sm:text-[13px]">
              {href ? (
                <Link
                  href={href}
                  className="transition-ui tabular-nums-price inline-flex min-h-8 max-w-full min-w-0 items-center underline-offset-4 hover:underline"
                >
                  <span className="line-clamp-2 sm:truncate sm:whitespace-nowrap">
                    {resolvedText}
                  </span>
                </Link>
              ) : (
                <p className="tabular-nums-price line-clamp-2 max-w-full sm:truncate sm:whitespace-nowrap">
                  {resolvedText}
                </p>
              )}

              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="transition-ui absolute right-0 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-current hover:opacity-80 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
