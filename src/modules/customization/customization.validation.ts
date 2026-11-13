import Decimal from "decimal.js";
import type { CustomizationValidationRules } from "@/modules/customization/customization.presets";

export type CustomizationGroupType =
  "SELECT" | "MULTI_SELECT" | "SWATCH" | "NUMBER_RANGE" | "TEXT" | "TEXTAREA" | "IMAGE_UPLOAD";

export interface CustomizationOptionValueDTO {
  id: string;
  value: string;
  label: string;
  swatchHex: string | null;
  swatchImageUrl: string | null;
  priceAdjustmentType: "NONE" | "FIXED" | "PERCENT";
  priceAdjustmentValue: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface CustomizationOptionGroupDTO {
  id: string;
  code: string;
  label: string;
  type: CustomizationGroupType;
  helperText: string | null;
  placeholder: string | null;
  required: boolean;
  minValue: string | null;
  maxValue: string | null;
  stepValue: string | null;
  defaultValue: string | null;
  maxLength: number | null;
  maxFiles: number | null;
  unit: string | null;
  validationRules: CustomizationValidationRules | null;
  isActive: boolean;
  sortOrder: number;
  source: "product" | "category";
  values: CustomizationOptionValueDTO[];
}

export interface SubmittedGroupInput {
  value?: string | null;
  values?: string[] | null;
  numberValue?: number | string | null;
  textValue?: string | null;
  imageCount?: number | null;
}

export interface NormalizedCustomizationSelection {
  groupId: string;
  groupCode: string;
  groupLabel: string;
  groupType: CustomizationGroupType;
  valueCodes: string[];
  rawText: string | null;
  numberValue: string | null;
  displayValue: string;
  swatchHex: string | null;
  priceDeltaBase: string;
}

export interface CustomizationValidationContext {
  basePriceBase: string | number;
  categorySlug: string;
  categoryName?: string;
  productHasStone?: boolean;
}

export interface ValidationFailureDetail {
  groupCode: string;
  message: string;
}

export function sanitizeCustomizationText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

export function computeOptionDeltaBase(
  basePrice: Decimal,
  type: "NONE" | "FIXED" | "PERCENT",
  rawValue: string | number,
): Decimal {
  const val = new Decimal(rawValue || 0);
  if (type === "FIXED") {
    return val.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  if (type === "PERCENT") {
    return basePrice.times(val).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return new Decimal(0);
}

/**
 * Evaluates conditional admin validation rules such as:
 * - ring size only applicable to rings categories
 * - diamond color/clarity only applicable when product/config includes a stone
 */
export function isCustomizationGroupApplicable(
  group: Pick<CustomizationOptionGroupDTO, "validationRules" | "isActive">,
  ctx: CustomizationValidationContext,
  allInputs: Record<string, SubmittedGroupInput | undefined>,
): boolean {
  if (!group.isActive) return false;
  const rules = group.validationRules;
  if (!rules) return true;

  if (rules.categoryKeywords && rules.categoryKeywords.length > 0) {
    const cat = `${ctx.categorySlug} ${ctx.categoryName ?? ""}`.toLowerCase();
    const matched = rules.categoryKeywords.some((kw) => cat.includes(kw.toLowerCase()));
    if (!matched) return false;
  }

  if (rules.requiresStone) {
    const stoneSelection = allInputs.stone_shape?.value;
    if (stoneSelection === "no_stone") return false;
    if (ctx.productHasStone === false && !stoneSelection) return false;
  }

  if (rules.dependsOn) {
    const depInput = allInputs[rules.dependsOn.groupCode];
    const selectedSet = new Set<string>([
      ...(depInput?.value ? [depInput.value] : []),
      ...(depInput?.values ?? []),
    ]);
    if (rules.dependsOn.valuesIn && rules.dependsOn.valuesIn.length > 0) {
      if (!rules.dependsOn.valuesIn.some((v) => selectedSet.has(v))) {
        return false;
      }
    }
    if (rules.dependsOn.valuesNotIn && rules.dependsOn.valuesNotIn.length > 0) {
      if (selectedSet.size > 0 && rules.dependsOn.valuesNotIn.some((v) => selectedSet.has(v))) {
        return false;
      }
    }
  }

  return true;
}

export function validateCustomizationSelections(params: {
  groups: CustomizationOptionGroupDTO[];
  inputs: Record<string, SubmittedGroupInput | undefined>;
  uploadedImageCount?: number;
  context: CustomizationValidationContext;
}):
  | {
      ok: true;
      selections: NormalizedCustomizationSelection[];
      indicativeMinBase: string;
      indicativeMaxBase: string;
    }
  | {
      ok: false;
      errors: ValidationFailureDetail[];
    } {
  const { groups, inputs, context, uploadedImageCount = 0 } = params;
  const basePrice = new Decimal(context.basePriceBase || 0);
  const groupByCode = new Map(groups.map((g) => [g.code, g]));
  const errors: ValidationFailureDetail[] = [];

  for (const submittedCode of Object.keys(inputs)) {
    const g = groupByCode.get(submittedCode);
    if (!g || !g.isActive) {
      errors.push({
        groupCode: submittedCode,
        message: `Customization group "${submittedCode}" is unknown or no longer enabled.`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const orderedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const selections: NormalizedCustomizationSelection[] = [];
  let deltaSum = new Decimal(0);

  for (const group of orderedGroups) {
    if (!isCustomizationGroupApplicable(group, context, inputs)) {
      continue;
    }

    const input = inputs[group.code];

    if (group.type === "SELECT" || group.type === "SWATCH") {
      const chosenCode = input?.value?.trim() ?? "";
      if (!chosenCode) {
        if (group.required) {
          errors.push({ groupCode: group.code, message: `${group.label} is required.` });
        }
        continue;
      }
      const opt = group.values.find((v) => v.value === chosenCode);
      if (!opt || !opt.isAvailable) {
        errors.push({
          groupCode: group.code,
          message: `Selected option for ${group.label} is invalid or unavailable.`,
        });
        continue;
      }
      const delta = computeOptionDeltaBase(
        basePrice,
        opt.priceAdjustmentType,
        opt.priceAdjustmentValue,
      );
      deltaSum = deltaSum.plus(delta);
      selections.push({
        groupId: group.id,
        groupCode: group.code,
        groupLabel: group.label,
        groupType: group.type,
        valueCodes: [opt.value],
        rawText: null,
        numberValue: null,
        displayValue: opt.label,
        swatchHex: opt.swatchHex,
        priceDeltaBase: delta.toFixed(2),
      });
      continue;
    }

    if (group.type === "MULTI_SELECT") {
      const chosenCodes = Array.from(
        new Set((input?.values ?? []).map((v) => v.trim()).filter(Boolean)),
      );
      if (chosenCodes.length === 0) {
        if (group.required) {
          errors.push({
            groupCode: group.code,
            message: `Select at least one option for ${group.label}.`,
          });
        }
        continue;
      }
      if (group.minValue && chosenCodes.length < Number(group.minValue)) {
        errors.push({
          groupCode: group.code,
          message: `Select at least ${group.minValue} options for ${group.label}.`,
        });
        continue;
      }
      if (group.maxValue && chosenCodes.length > Number(group.maxValue)) {
        errors.push({
          groupCode: group.code,
          message: `Select at most ${group.maxValue} options for ${group.label}.`,
        });
        continue;
      }

      const matchedOpts = [];
      let multiDelta = new Decimal(0);
      let hasInvalidOpt = false;
      for (const code of chosenCodes) {
        const opt = group.values.find((v) => v.value === code);
        if (!opt || !opt.isAvailable) {
          errors.push({
            groupCode: group.code,
            message: `One or more selected options in ${group.label} are unavailable.`,
          });
          hasInvalidOpt = true;
          break;
        }
        matchedOpts.push(opt);
        multiDelta = multiDelta.plus(
          computeOptionDeltaBase(basePrice, opt.priceAdjustmentType, opt.priceAdjustmentValue),
        );
      }
      if (hasInvalidOpt) continue;

      deltaSum = deltaSum.plus(multiDelta);
      selections.push({
        groupId: group.id,
        groupCode: group.code,
        groupLabel: group.label,
        groupType: group.type,
        valueCodes: matchedOpts.map((o) => o.value),
        rawText: null,
        numberValue: null,
        displayValue: matchedOpts.map((o) => o.label).join(", "),
        swatchHex: null,
        priceDeltaBase: multiDelta.toFixed(2),
      });
      continue;
    }

    if (group.type === "NUMBER_RANGE") {
      const rawNum = input?.numberValue ?? input?.value;
      const strNum = rawNum === undefined || rawNum === null ? "" : String(rawNum).trim();
      if (!strNum) {
        if (group.required) {
          errors.push({ groupCode: group.code, message: `${group.label} is required.` });
        }
        continue;
      }
      const parsed = Number(strNum);
      if (!Number.isFinite(parsed)) {
        errors.push({ groupCode: group.code, message: `${group.label} must be a valid number.` });
        continue;
      }
      if (group.minValue !== null && parsed < Number(group.minValue)) {
        errors.push({
          groupCode: group.code,
          message: `${group.label} cannot be less than ${group.minValue}${group.unit ? ` ${group.unit}` : ""}.`,
        });
        continue;
      }
      if (group.maxValue !== null && parsed > Number(group.maxValue)) {
        errors.push({
          groupCode: group.code,
          message: `${group.label} cannot exceed ${group.maxValue}${group.unit ? ` ${group.unit}` : ""}.`,
        });
        continue;
      }
      selections.push({
        groupId: group.id,
        groupCode: group.code,
        groupLabel: group.label,
        groupType: group.type,
        valueCodes: [],
        rawText: null,
        numberValue: String(parsed),
        displayValue: `${parsed}${group.unit ? ` ${group.unit}` : ""}`,
        swatchHex: null,
        priceDeltaBase: "0.00",
      });
      continue;
    }

    if (group.type === "TEXT" || group.type === "TEXTAREA") {
      const rawText = input?.textValue ?? input?.value ?? "";
      const cleaned = sanitizeCustomizationText(rawText);
      if (!cleaned) {
        if (group.required) {
          errors.push({ groupCode: group.code, message: `${group.label} is required.` });
        }
        continue;
      }
      const maxLen = group.maxLength ?? (group.type === "TEXT" ? 120 : 1500);
      if (cleaned.length > maxLen) {
        errors.push({
          groupCode: group.code,
          message: `${group.label} exceeds maximum length of ${maxLen} characters.`,
        });
        continue;
      }
      selections.push({
        groupId: group.id,
        groupCode: group.code,
        groupLabel: group.label,
        groupType: group.type,
        valueCodes: [],
        rawText: cleaned,
        numberValue: null,
        displayValue: cleaned,
        swatchHex: null,
        priceDeltaBase: "0.00",
      });
      continue;
    }

    if (group.type === "IMAGE_UPLOAD") {
      const count = input?.imageCount ?? uploadedImageCount;
      const cap = Math.min(5, group.maxFiles ?? 5);
      if (group.required && count <= 0) {
        errors.push({
          groupCode: group.code,
          message: `Please attach at least one reference image for ${group.label}.`,
        });
        continue;
      }
      if (count > cap) {
        errors.push({
          groupCode: group.code,
          message: `At most ${cap} reference images are permitted.`,
        });
        continue;
      }
      if (count > 0) {
        selections.push({
          groupId: group.id,
          groupCode: group.code,
          groupLabel: group.label,
          groupType: group.type,
          valueCodes: [],
          rawText: null,
          numberValue: String(count),
          displayValue: `${count} reference image${count === 1 ? "" : "s"}`,
          swatchHex: null,
          priceDeltaBase: "0.00",
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const minEstimate = Decimal.max(0, basePrice.plus(deltaSum)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  // Bespoke artisanal buffer (+10% upper indicative ceiling unless exact flat quote issued by atelier)
  const maxEstimate = minEstimate.times("1.10").toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    ok: true,
    selections,
    indicativeMinBase: minEstimate.toFixed(2),
    indicativeMaxBase: maxEstimate.toFixed(2),
  };
}

export function parseOrderCustomizationSnapshot(raw: unknown): {
  requestNumber: string | null;
  lines: Array<{ label: string; value: string }>;
} {
  if (!raw || typeof raw !== "object") {
    return { requestNumber: null, lines: [] };
  }
  const obj = raw as {
    requestNumber?: unknown;
    selections?: Array<{ groupLabel?: unknown; displayValue?: unknown }>;
  };
  const requestNumber = typeof obj.requestNumber === "string" ? obj.requestNumber : null;
  const lines = Array.isArray(obj.selections)
    ? obj.selections
        .filter((s): s is { groupLabel: string; displayValue: string } =>
          Boolean(s && typeof s.groupLabel === "string" && typeof s.displayValue === "string"),
        )
        .map((s) => ({ label: s.groupLabel, value: s.displayValue }))
    : [];
  return { requestNumber, lines };
}
