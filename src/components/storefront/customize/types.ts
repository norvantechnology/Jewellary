import Decimal from "decimal.js";
import type {
  CustomizationRequestDetailDTO,
  ProductCustomizationSchemaDTO,
} from "@/modules/customization/customization.service";
import {
  computeOptionDeltaBase,
  isCustomizationGroupApplicable,
  type CustomizationOptionGroupDTO,
  type SubmittedGroupInput,
} from "@/modules/customization/customization.validation";

export interface UploadedCustomizationImageItem {
  storageKey: string;
  thumbKey?: string;
  url: string;
  thumbUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
}

export interface PendingCustomizationUpload {
  localId: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: "uploading" | "error";
  error?: string;
}

export type CustomizeStep = 1 | 2 | 3;

export type ContactUiChoice = "EMAIL" | "PHONE" | "CHAT";

export function buildInitialInputs(
  schema: ProductCustomizationSchemaDTO,
  initialRequest?: CustomizationRequestDetailDTO,
): Record<string, SubmittedGroupInput> {
  const result: Record<string, SubmittedGroupInput> = {};

  if (initialRequest) {
    for (const sel of initialRequest.selections) {
      if (sel.groupType === "SELECT" || sel.groupType === "SWATCH") {
        result[sel.groupCode] = { value: sel.valueCodes[0] ?? "" };
      } else if (sel.groupType === "MULTI_SELECT") {
        result[sel.groupCode] = { values: [...sel.valueCodes] };
      } else if (sel.groupType === "NUMBER_RANGE") {
        result[sel.groupCode] = { numberValue: sel.numberValue ?? "" };
      } else if (sel.groupType === "TEXT" || sel.groupType === "TEXTAREA") {
        result[sel.groupCode] = { textValue: sel.rawText ?? "" };
      }
    }
    return result;
  }

  for (const group of schema.groups) {
    if (!group.isActive) continue;
    if ((group.type === "SELECT" || group.type === "SWATCH") && group.defaultValue) {
      const validDefault = group.values.find(
        (v) => v.isAvailable && v.value === group.defaultValue,
      );
      if (validDefault) {
        result[group.code] = { value: validDefault.value };
      }
    } else if (group.type === "NUMBER_RANGE" && group.defaultValue) {
      result[group.code] = { numberValue: group.defaultValue };
    } else if ((group.type === "TEXT" || group.type === "TEXTAREA") && group.defaultValue) {
      result[group.code] = { textValue: group.defaultValue };
    }
  }
  return result;
}

export function estimateIndicativeRange(
  schema: ProductCustomizationSchemaDTO,
  inputs: Record<string, SubmittedGroupInput>,
): { minBase: string; maxBase: string } {
  const basePrice = new Decimal(schema.productBasePriceBase || 0);
  let deltaSum = new Decimal(0);

  for (const group of schema.groups) {
    const visible = isCustomizationGroupApplicable(
      group,
      {
        basePriceBase: schema.productBasePriceBase,
        categorySlug: schema.categorySlug,
        categoryName: schema.categoryName,
        productHasStone: schema.productHasStone,
      },
      inputs,
    );
    if (!visible) continue;

    const input = inputs[group.code];
    if (group.type === "SELECT" || group.type === "SWATCH") {
      const code = input?.value?.trim();
      const opt = group.values.find((v) => v.value === code && v.isAvailable);
      if (opt) {
        deltaSum = deltaSum.plus(
          computeOptionDeltaBase(basePrice, opt.priceAdjustmentType, opt.priceAdjustmentValue),
        );
      }
    } else if (group.type === "MULTI_SELECT") {
      const chosen = new Set(input?.values ?? []);
      for (const opt of group.values) {
        if (opt.isAvailable && chosen.has(opt.value)) {
          deltaSum = deltaSum.plus(
            computeOptionDeltaBase(basePrice, opt.priceAdjustmentType, opt.priceAdjustmentValue),
          );
        }
      }
    }
  }

  const minEstimate = Decimal.max(0, basePrice.plus(deltaSum)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const maxEstimate = minEstimate.times("1.10").toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    minBase: minEstimate.toFixed(2),
    maxBase: maxEstimate.toFixed(2),
  };
}

export function formatOptionAdjustment(
  opt: CustomizationOptionGroupDTO["values"][number],
  formatPrice: (amountBase: string | number) => string,
): string {
  if (opt.priceAdjustmentType === "NONE" || Number(opt.priceAdjustmentValue) === 0) {
    return "";
  }
  if (opt.priceAdjustmentType === "PERCENT") {
    const pct = Number(opt.priceAdjustmentValue);
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }
  const baseDelta = Number(opt.priceAdjustmentValue);
  return `${baseDelta > 0 ? "+" : ""}${formatPrice(baseDelta)}`;
}
