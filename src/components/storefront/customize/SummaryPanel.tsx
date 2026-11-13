"use client";

import * as React from "react";
import { Info, Loader2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHeaderOffset } from "@/components/storefront/customize/useHeaderOffset";
import type { ContactUiChoice } from "@/components/storefront/customize/types";
import { useReducedMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  CustomizationOptionGroupDTO,
  SubmittedGroupInput,
} from "@/modules/customization/customization.validation";

interface SummaryRow {
  code: string;
  label: string;
  valueText: string | null;
  missingRequired: boolean;
}

interface SummaryPanelProps {
  visibleGroups: CustomizationOptionGroupDTO[];
  inputs: Record<string, SubmittedGroupInput>;
  imageCount: number;
  estimatedMinBase: string;
  mode: "create" | "edit";
  variant: "page" | "drawer";
  submitting: boolean;
  showContactSummary?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  contactUiChoice?: ContactUiChoice;
  onEditGroup: (groupCode: string) => void;
  onEditDetails?: () => void;
  onSubmitClick?: () => void;
  onCancel?: () => void;
}

function buildGroupSummaryRow(
  group: CustomizationOptionGroupDTO,
  input: SubmittedGroupInput | undefined,
  imageCount: number,
): SummaryRow | null {
  if (group.type === "SELECT" || group.type === "SWATCH") {
    const code = input?.value?.trim();
    const opt = code ? group.values.find((v) => v.value === code) : undefined;
    if (opt) {
      return {
        code: group.code,
        label: group.label,
        valueText: opt.label,
        missingRequired: false,
      };
    }
    if (group.required) {
      return {
        code: group.code,
        label: group.label,
        valueText: null,
        missingRequired: true,
      };
    }
    return null;
  }

  if (group.type === "MULTI_SELECT") {
    const chosen = new Set(input?.values ?? []);
    const labels = group.values.filter((v) => chosen.has(v.value)).map((v) => v.label);
    if (labels.length > 0) {
      return {
        code: group.code,
        label: group.label,
        valueText: labels.join(", "),
        missingRequired: false,
      };
    }
    if (group.required) {
      return {
        code: group.code,
        label: group.label,
        valueText: null,
        missingRequired: true,
      };
    }
    return null;
  }

  if (group.type === "NUMBER_RANGE") {
    const raw = String(input?.numberValue ?? input?.value ?? "").trim();
    if (raw) {
      return {
        code: group.code,
        label: group.label,
        valueText: `${raw}${group.unit ? ` ${group.unit}` : ""}`,
        missingRequired: false,
      };
    }
    if (group.required) {
      return {
        code: group.code,
        label: group.label,
        valueText: null,
        missingRequired: true,
      };
    }
    return null;
  }

  if (group.type === "TEXT" || group.type === "TEXTAREA") {
    const txt = (input?.textValue ?? input?.value ?? "").trim();
    if (txt) {
      return {
        code: group.code,
        label: group.label,
        valueText: txt,
        missingRequired: false,
      };
    }
    if (group.required) {
      return {
        code: group.code,
        label: group.label,
        valueText: null,
        missingRequired: true,
      };
    }
    return null;
  }

  if (group.type === "IMAGE_UPLOAD") {
    if (imageCount > 0) {
      return {
        code: group.code,
        label: group.label,
        valueText: `${imageCount} ${imageCount === 1 ? "image" : "images"}`,
        missingRequired: false,
      };
    }
    if (group.required) {
      return {
        code: group.code,
        label: group.label,
        valueText: null,
        missingRequired: true,
      };
    }
    return null;
  }

  return null;
}

export function SummaryPanel({
  visibleGroups,
  inputs,
  imageCount,
  estimatedMinBase,
  mode,
  variant,
  submitting,
  showContactSummary = false,
  customerName,
  customerEmail,
  customerPhone,
  contactUiChoice = "EMAIL",
  onEditGroup,
  onEditDetails,
  onSubmitClick,
  onCancel,
}: SummaryPanelProps) {
  const { formatPrice } = useCurrency();
  const reducedMotion = useReducedMotionSafe();
  const { desktopStickyTop } = useHeaderOffset(variant === "page");
  const [infoOpen, setInfoOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    const result: SummaryRow[] = [];
    for (const group of visibleGroups) {
      const row = buildGroupSummaryRow(group, inputs[group.code], imageCount);
      if (row) result.push(row);
    }
    return result;
  }, [visibleGroups, inputs, imageCount]);

  const formattedEstimate = formatPrice(estimatedMinBase);

  const submitLabel =
    mode === "edit"
      ? submitting
        ? "Saving..."
        : "Save changes"
      : submitting
        ? "Sending..."
        : "Send request";

  const contactLabel =
    contactUiChoice === "PHONE"
      ? customerPhone?.trim()
        ? `Phone · ${customerPhone.trim()}`
        : "Phone"
      : contactUiChoice === "CHAT"
        ? `Atelier Chat · ${customerEmail?.trim() || "Email"}`
        : customerEmail?.trim() || "Email";

  return (
    <aside
      aria-label="Specification summary"
      style={
        variant === "page"
          ? ({ "--summary-sticky-top": `${desktopStickyTop}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-xs",
        variant === "page" &&
          "lg:sticky lg:top-[var(--summary-sticky-top)] lg:w-[360px] lg:transition-[top] lg:duration-200",
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <h2 className="text-base leading-6 font-semibold text-foreground">
            {variant === "page" ? (
              <>
                <span className="hidden lg:inline">Summary</span>
                <span className="lg:hidden">Review</span>
              </>
            ) : (
              "Review"
            )}
          </h2>
          {rows.some((r) => r.missingRequired) ? (
            <span className="text-xs font-medium text-destructive">Action needed</span>
          ) : null}
        </div>

        {rows.length === 0 && !showContactSummary ? (
          <p className="text-sm text-muted-foreground">
            Your selected specifications will appear here.
          </p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {rows.map((row) => (
              <li
                key={row.code}
                className="flex items-start justify-between gap-3 border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-xs text-muted-foreground">{row.label}</span>
                  <div className="font-medium break-words text-foreground">
                    {row.valueText ? (
                      row.valueText
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Required
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEditGroup(row.code)}
                  className="min-h-8 shrink-0 rounded px-1.5 text-xs font-medium text-accent-text underline underline-offset-4 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Edit
                </button>
              </li>
            ))}

            {showContactSummary ? (
              <li
                className={cn(
                  "flex items-start justify-between gap-3 border-t border-border/70 pt-2.5",
                  variant === "page" && "lg:hidden",
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-xs text-muted-foreground">Contact</span>
                  <div className="font-medium break-words text-foreground">
                    {customerName?.trim() ? `${customerName.trim()} · ` : ""}
                    {contactLabel}
                  </div>
                </div>
                {onEditDetails ? (
                  <button
                    type="button"
                    onClick={onEditDetails}
                    className="min-h-8 shrink-0 rounded px-1.5 text-xs font-medium text-accent-text underline underline-offset-4 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Edit
                  </button>
                ) : null}
              </li>
            ) : null}
          </ul>
        )}

        {/* Price Block */}
        <div className="space-y-1 rounded-lg bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">Estimated price</span>
              <TooltipProvider delayDuration={150}>
                <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setInfoOpen((prev) => !prev)}
                      aria-label="About estimated price: Final quote confirmed by our atelier."
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-center">
                    Final quote confirmed by our atelier.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div aria-live="polite" className="shrink-0 text-right">
              <AnimatePresence mode="wait" initial={false}>
                <m.span
                  key={formattedEstimate}
                  initial={reducedMotion ? false : { opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0.35 }}
                  transition={{ duration: reducedMotion ? 0 : 0.16 }}
                  data-testid="summary-estimated-price"
                  className="tabular-nums-price block text-base font-semibold text-foreground"
                >
                  from {formattedEstimate}
                </m.span>
              </AnimatePresence>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Typically ready in 3–4 weeks</p>
        </div>

        {/* Actions rendered inside SummaryPanel for Desktop Page single-scroll, or Cancel text link on mobile/drawer Review */}
        {variant === "page" ? (
          <div className="hidden space-y-2.5 pt-1 lg:block">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={submitting}
              data-testid="submit-customization-request"
              onClick={onSubmitClick}
              className="h-11 w-full text-sm font-medium"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              <span>{submitLabel}</span>
            </Button>

            {onCancel ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="min-h-10 rounded px-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {onCancel ? (
          <div className={cn("flex justify-center pt-1", variant === "page" && "lg:hidden")}>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-10 rounded px-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
