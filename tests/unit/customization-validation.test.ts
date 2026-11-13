// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CUSTOMIZATION_CATEGORY_PRESETS,
  type PresetOptionGroupDraft,
  type PresetOptionValueDraft,
} from "@/modules/customization/customization.presets";
import {
  isCustomizationGroupApplicable,
  parseOrderCustomizationSnapshot,
  sanitizeCustomizationText,
  validateCustomizationSelections,
  type CustomizationOptionGroupDTO,
} from "@/modules/customization/customization.validation";

function makeRingGroups(): CustomizationOptionGroupDTO[] {
  return CUSTOMIZATION_CATEGORY_PRESETS.rings.map(
    (preset: PresetOptionGroupDraft, idx: number) => ({
      id: `grp-${idx + 1}`,
      code: preset.code,
      label: preset.label,
      type: preset.type,
      helperText: preset.helperText ?? null,
      placeholder: preset.placeholder ?? null,
      required: preset.required,
      minValue:
        preset.minValue !== undefined && preset.minValue !== null ? String(preset.minValue) : null,
      maxValue:
        preset.maxValue !== undefined && preset.maxValue !== null ? String(preset.maxValue) : null,
      stepValue:
        preset.stepValue !== undefined && preset.stepValue !== null
          ? String(preset.stepValue)
          : null,
      defaultValue: preset.defaultValue ?? null,
      maxLength: preset.maxLength ?? null,
      maxFiles: preset.maxFiles ?? null,
      unit: preset.unit ?? null,
      validationRules: preset.validationRules ?? null,
      isActive: preset.isActive ?? true,
      sortOrder: preset.sortOrder ?? idx,
      source: "product",
      values: (preset.values ?? []).map((val: PresetOptionValueDraft, vIdx: number) => ({
        id: `val-${idx + 1}-${vIdx + 1}`,
        value: val.value,
        label: val.label,
        swatchHex: val.swatchHex ?? null,
        swatchImageUrl: val.swatchImageUrl ?? null,
        priceAdjustmentType: val.priceAdjustmentType ?? "NONE",
        priceAdjustmentValue: String(val.priceAdjustmentValue ?? "0"),
        isAvailable: val.isAvailable ?? true,
        sortOrder: val.sortOrder ?? vIdx,
      })),
    }),
  );
}

describe("Customization validation & conditional rules", () => {
  it("applies ring size only for rings and requiresStone rules cleanly", () => {
    const groups = makeRingGroups();
    const ringSizeGroup = groups.find((g) => g.code === "ring_size")!;
    const colorGradeGroup = groups.find((g) => g.code === "diamond_color")!;

    expect(
      isCustomizationGroupApplicable(
        ringSizeGroup,
        {
          basePriceBase: "2400",
          categorySlug: "rings",
          categoryName: "Rings",
          productHasStone: true,
        },
        {},
      ),
    ).toBe(true);

    expect(
      isCustomizationGroupApplicable(
        ringSizeGroup,
        {
          basePriceBase: "2400",
          categorySlug: "necklaces",
          categoryName: "Necklaces",
          productHasStone: true,
        },
        {},
      ),
    ).toBe(false);

    expect(
      isCustomizationGroupApplicable(
        colorGradeGroup,
        { basePriceBase: "2400", categorySlug: "rings", productHasStone: false },
        {},
      ),
    ).toBe(false);

    expect(
      isCustomizationGroupApplicable(
        colorGradeGroup,
        { basePriceBase: "2400", categorySlug: "rings", productHasStone: false },
        { stone_shape: { value: "oval" } },
      ),
    ).toBe(true);
  });

  it("sanitizes angle brackets/control chars and calculates indicative min/max estimates", () => {
    expect(sanitizeCustomizationText("<script>Aurelia\u0007")).toBe("scriptAurelia");

    const groups = makeRingGroups();
    const metalDefault = groups.find((g) => g.code === "metal")!.values[0]!.value;
    const stoneDefault = groups.find((g) => g.code === "stone_shape")!.values[0]!.value;
    const colorDefault = groups.find((g) => g.code === "diamond_color")!.values[0]!.value;
    const clarityDefault = groups.find((g) => g.code === "clarity")!.values[0]!.value;
    const sizeDefault = groups.find((g) => g.code === "ring_size")!.values[0]!.value;

    const result = validateCustomizationSelections({
      groups,
      inputs: {
        metal: { value: metalDefault },
        stone_shape: { value: stoneDefault },
        diamond_color: { value: colorDefault },
        clarity: { value: clarityDefault },
        carat_weight: { numberValue: 1.5 },
        ring_size: { value: sizeDefault },
        engraving: { textValue: "Forever <3" },
      },
      context: {
        basePriceBase: "2000.00",
        categorySlug: "rings",
        categoryName: "Rings",
        productHasStone: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number(result.indicativeMinBase)).toBeGreaterThanOrEqual(2000);
      expect(Number(result.indicativeMaxBase)).toBeGreaterThanOrEqual(
        Number(result.indicativeMinBase),
      );
      const engraving = result.selections.find((s) => s.groupCode === "engraving");
      expect(engraving?.displayValue).toBe("Forever 3");
    }
  });

  it("rejects out-of-bounds carat weights and missing required selections", () => {
    const groups = makeRingGroups();
    const invalid = validateCustomizationSelections({
      groups,
      inputs: {
        carat_weight: { numberValue: 99 },
      },
      context: {
        basePriceBase: "2000.00",
        categorySlug: "rings",
        productHasStone: true,
      },
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.some((e) => e.groupCode === "metal")).toBe(true);
      expect(invalid.errors.some((e) => e.groupCode === "carat_weight")).toBe(true);
    }
  });

  it("parses order item customization snapshots safely", () => {
    const parsed = parseOrderCustomizationSnapshot({
      requestId: "req_1",
      requestNumber: "CR-2026-10001",
      selections: [
        {
          groupCode: "metal",
          groupLabel: "Metal",
          displayValue: "18K Rose Gold",
          priceDeltaBase: "0.00",
        },
        {
          groupCode: "engraving",
          groupLabel: "Engraving",
          displayValue: "M & A",
          priceDeltaBase: "50.00",
        },
      ],
    });

    expect(parsed.requestNumber).toBe("CR-2026-10001");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]).toEqual({ label: "Metal", value: "18K Rose Gold" });
  });
});
