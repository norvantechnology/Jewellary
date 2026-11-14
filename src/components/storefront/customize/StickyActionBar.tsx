"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CustomizeStep } from "@/components/storefront/customize/types";

interface StickyActionBarProps {
  variant: "page" | "drawer";
  step: CustomizeStep;
  mode: "create" | "edit";
  estimatedMinBase: string;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmitClick: () => void;
  isDesktopPage?: boolean;
}

export function StickyActionBar({
  variant,
  step,
  mode,
  estimatedMinBase,
  submitting,
  onBack,
  onNext,
  onSubmitClick,
  isDesktopPage = false,
}: StickyActionBarProps) {
  const ui = useUiText();
  const { formatPrice } = useCurrency();
  const reducedMotion = useReducedMotionSafe();

  const submitLabel =
    mode === "edit"
      ? submitting
        ? ui.customize.actions.saving
        : ui.customize.actions.save
      : submitting
        ? ui.customize.actions.sending
        : ui.customize.actions.send;

  return (
    <div
      data-sticky-cta={variant === "page" && !isDesktopPage ? "true" : undefined}
      className={cn(
        "flex items-center border-t border-border bg-surface/95 backdrop-blur-md",
        variant === "drawer"
          ? "min-h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] shrink-0 px-5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] sm:px-6 [@media(max-height:500px)]:min-h-[calc(4rem+env(safe-area-inset-bottom,0px))] [@media(max-height:500px)]:py-2"
          : "fixed inset-x-0 bottom-0 z-[var(--z-sticky)] min-h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] px-5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] shadow-md sm:px-6 lg:hidden [@media(max-height:500px)]:min-h-[calc(4rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3",
          variant === "page" && "mx-auto max-w-[720px]",
        )}
      >
        <div className="min-w-0">
          <span className="block text-xs font-medium text-muted-foreground">
            {ui.customize.actions.estimatedPrice}
          </span>
          <div aria-live="polite" className="min-h-6">
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={estimatedMinBase}
                initial={reducedMotion ? false : { opacity: 0.35 }}
                animate={{ opacity: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0.35 }}
                transition={{ duration: reducedMotion ? 0 : 0.16 }}
                className="tabular-nums-price block truncate text-lg leading-[1.3] font-semibold text-foreground"
              >
                from {formatPrice(estimatedMinBase)}
              </m.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              aria-label={ui.customize.actions.back}
              onClick={onBack}
              disabled={submitting}
              className="h-12 w-12 shrink-0 rounded-xl p-0 text-[15px] font-medium text-foreground min-[480px]:w-auto min-[480px]:px-4"
            >
              <ArrowLeft className="size-5 min-[480px]:hidden" aria-hidden="true" />
              <span className="hidden min-[480px]:inline">{ui.customize.actions.back}</span>
            </Button>
          ) : null}

          {step < 3 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onNext}
              className="h-12 min-w-[120px] rounded-xl px-5 text-[15px] font-semibold"
            >
              {ui.customize.actions.next}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={submitting}
              data-testid="submit-customization-request"
              onClick={onSubmitClick}
              className="h-12 min-w-[120px] rounded-xl px-5 text-[15px] font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{submitLabel}</span>
                </>
              ) : (
                submitLabel
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
