"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { CUSTOMIZATION_SWATCH_FALLBACK } from "@/lib/customization-swatches";
import {
  adminApplyCustomizationPresetAction,
  adminSaveCategoryCustomizationAction,
  adminSaveProductCustomizationAction,
} from "@/modules/customization/customization.actions";
import type {
  CustomizationGroupType,
  CustomizationOptionGroupDTO,
  CustomizationOptionValueDTO,
} from "@/modules/customization/customization.validation";

type CustomizationGroupTypeValue = CustomizationGroupType;
type PriceAdjustmentTypeValue = "NONE" | "FIXED" | "PERCENT";
import type { CustomizationPresetKey } from "@/modules/customization/customization.presets";

interface EditorResponseData {
  productId: string;
  categoryId: string;
  categoryName: string;
  enabled: boolean;
  inheritCategoryDefaults: boolean;
  minLeadTimeDays: number;
  disclaimerText: string;
  detectedPresetKey: CustomizationPresetKey;
  productGroups: CustomizationOptionGroupDTO[];
  categoryGroups: CustomizationOptionGroupDTO[];
}

interface EditableOptionValue {
  id?: string;
  value: string;
  label: string;
  swatchHex: string;
  swatchImageUrl: string;
  priceAdjustmentType: PriceAdjustmentTypeValue;
  priceAdjustmentValue: string;
  isAvailable: boolean;
}

interface EditableOptionGroup {
  localKey: string;
  id?: string;
  code: string;
  label: string;
  type: CustomizationGroupTypeValue;
  helperText: string;
  placeholder: string;
  required: boolean;
  minValue: string;
  maxValue: string;
  stepValue: string;
  defaultValue: string;
  maxLength: string;
  maxFiles: string;
  unit: string;
  requiresStone: boolean;
  dependsOnGroupCode: string;
  dependsOnValuesCsv: string;
  isActive: boolean;
  values: EditableOptionValue[];
}

function toEditableGroup(g: CustomizationOptionGroupDTO, idx: number): EditableOptionGroup {
  return {
    localKey: g.id ?? `${g.code}-${idx}`,
    id: g.id,
    code: g.code,
    label: g.label,
    type: g.type,
    helperText: g.helperText ?? "",
    placeholder: g.placeholder ?? "",
    required: g.required,
    minValue: g.minValue ?? "",
    maxValue: g.maxValue ?? "",
    stepValue: g.stepValue ?? "",
    defaultValue: g.defaultValue ?? "",
    maxLength: g.maxLength ? String(g.maxLength) : "",
    maxFiles: g.maxFiles ? String(g.maxFiles) : "",
    unit: g.unit ?? "",
    requiresStone: Boolean(g.validationRules?.requiresStone),
    dependsOnGroupCode: g.validationRules?.dependsOn?.groupCode ?? "",
    dependsOnValuesCsv: (g.validationRules?.dependsOn?.valuesIn ?? []).join(", "),
    isActive: g.isActive,
    values: g.values.map((v) => ({
      id: v.id,
      value: v.value,
      label: v.label,
      swatchHex: v.swatchHex ?? "",
      swatchImageUrl: v.swatchImageUrl ?? "",
      priceAdjustmentType: v.priceAdjustmentType,
      priceAdjustmentValue: v.priceAdjustmentValue,
      isAvailable: v.isAvailable,
    })),
  };
}

function toSubmissionGroups(groups: EditableOptionGroup[]) {
  return groups.map((g, gIdx) => {
    const depValues = g.dependsOnValuesCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hasRules = Boolean(g.requiresStone || g.dependsOnGroupCode.trim());

    return {
      code:
        g.code
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "") || `group_${gIdx + 1}`,
      label: g.label.trim() || `Option ${gIdx + 1}`,
      type: g.type,
      helperText: g.helperText.trim() || null,
      placeholder: g.placeholder.trim() || null,
      required: g.required,
      minValue: g.minValue.trim() || null,
      maxValue: g.maxValue.trim() || null,
      stepValue: g.stepValue.trim() || null,
      defaultValue: g.defaultValue.trim() || null,
      maxLength: g.maxLength.trim() ? Number(g.maxLength.trim()) : null,
      maxFiles: g.maxFiles.trim() ? Math.min(5, Math.max(1, Number(g.maxFiles.trim()))) : null,
      unit: g.unit.trim() || null,
      validationRules: hasRules
        ? {
            ...(g.requiresStone ? { requiresStone: true } : {}),
            ...(g.dependsOnGroupCode.trim()
              ? {
                  dependsOn: {
                    groupCode: g.dependsOnGroupCode.trim(),
                    ...(depValues.length > 0 ? { valuesIn: depValues } : {}),
                  },
                }
              : {}),
          }
        : null,
      isActive: g.isActive,
      sortOrder: gIdx,
      values: g.values.map((v, vIdx) => ({
        value: v.value.trim().replace(/[^a-zA-Z0-9_.-]+/g, "_") || `opt_${vIdx + 1}`,
        label: v.label.trim() || `Choice ${vIdx + 1}`,
        swatchHex: /^#[0-9a-fA-F]{6}$/.test(v.swatchHex.trim()) ? v.swatchHex.trim() : null,
        swatchImageUrl: v.swatchImageUrl.trim() || null,
        priceAdjustmentType: v.priceAdjustmentType,
        priceAdjustmentValue: v.priceAdjustmentValue.trim() || "0",
        isAvailable: v.isAvailable,
        sortOrder: vIdx,
      })),
    };
  });
}

function createEmptyGroup(index: number): EditableOptionGroup {
  const code = `custom_option_${index + 1}`;
  return {
    localKey: `${code}-${Date.now()}`,
    code,
    label: "Custom Specification",
    type: "SELECT",
    helperText: "",
    placeholder: "",
    required: false,
    minValue: "",
    maxValue: "",
    stepValue: "",
    defaultValue: "",
    maxLength: "",
    maxFiles: "",
    unit: "",
    requiresStone: false,
    dependsOnGroupCode: "",
    dependsOnValuesCsv: "",
    isActive: true,
    values: [
      {
        value: "standard",
        label: "Standard option",
        swatchHex: "",
        swatchImageUrl: "",
        priceAdjustmentType: "NONE",
        priceAdjustmentValue: "0",
        isAvailable: true,
      },
    ],
  };
}

const OPTION_CHOICE_TYPES = new Set<CustomizationGroupTypeValue>([
  "SELECT",
  "MULTI_SELECT",
  "SWATCH",
]);

interface AdminProductCustomizationTabProps {
  productId: string | undefined;
  productSlug: string;
}

export function AdminProductCustomizationTab({
  productId,
  productSlug,
}: AdminProductCustomizationTabProps) {
  const [loading, setLoading] = React.useState(Boolean(productId));
  const [saving, setSaving] = React.useState(false);
  const [applyingPreset, setApplyingPreset] = React.useState(false);

  const [categoryId, setCategoryId] = React.useState("");
  const [categoryName, setCategoryName] = React.useState("");
  const [enabled, setEnabled] = React.useState(false);
  const [inheritDefaults, setInheritDefaults] = React.useState(true);
  const [minLeadTimeDays, setMinLeadTimeDays] = React.useState("21");
  const [disclaimerText, setDisclaimerText] = React.useState("");
  const [presetKey, setPresetKey] = React.useState<CustomizationPresetKey>("rings");
  const [editScope, setEditScope] = React.useState<"product" | "category">("product");
  const [productGroups, setProductGroups] = React.useState<EditableOptionGroup[]>([]);
  const [categoryGroups, setCategoryGroups] = React.useState<EditableOptionGroup[]>([]);

  const loadConfig = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/customization`);
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: EditorResponseData;
        error?: string;
      } | null;
      if (!res.ok || !json?.data) {
        throw new Error(json?.error ?? "Unable to load customization configuration.");
      }
      const d = json.data;
      setCategoryId(d.categoryId);
      setCategoryName(d.categoryName);
      setEnabled(d.enabled);
      setInheritDefaults(d.inheritCategoryDefaults);
      setMinLeadTimeDays(String(d.minLeadTimeDays ?? 21));
      setDisclaimerText(d.disclaimerText ?? "");
      setPresetKey(d.detectedPresetKey);
      setProductGroups(d.productGroups.map(toEditableGroup));
      setCategoryGroups(d.categoryGroups.map(toEditableGroup));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load customization data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!productId) return;
    let active = true;
    fetch(`/api/admin/products/${encodeURIComponent(productId)}/customization`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: EditorResponseData;
          error?: string;
        } | null;
        if (!res.ok || !json?.data) {
          throw new Error(json?.error ?? "Unable to load customization configuration.");
        }
        return json.data;
      })
      .then((d) => {
        if (!active) return;
        setCategoryId(d.categoryId);
        setCategoryName(d.categoryName);
        setEnabled(d.enabled);
        setInheritDefaults(d.inheritCategoryDefaults);
        setMinLeadTimeDays(String(d.minLeadTimeDays ?? 21));
        setDisclaimerText(d.disclaimerText ?? "");
        setPresetKey(d.detectedPresetKey);
        setProductGroups(d.productGroups.map(toEditableGroup));
        setCategoryGroups(d.categoryGroups.map(toEditableGroup));
      })
      .catch((err: unknown) => {
        if (active) {
          toast.error(err instanceof Error ? err.message : "Failed to load customization data.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  if (!productId) {
    return (
      <Card>
        <CardHeader>
          <h2 className="font-display text-xl font-medium">Customization</h2>
          <CardDescription>
            Save the product draft first to set up customization options and category presets.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeGroups = editScope === "product" ? productGroups : categoryGroups;
  const setActiveGroups = editScope === "product" ? setProductGroups : setCategoryGroups;

  function moveGroup(idx: number, delta: -1 | 1) {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= activeGroups.length) return;
    const copy = [...activeGroups];
    const [removed] = copy.splice(idx, 1);
    if (removed) {
      copy.splice(nextIdx, 0, removed);
      setActiveGroups(copy);
    }
  }

  function duplicateGroup(idx: number) {
    const src = activeGroups[idx];
    if (!src) return;
    const copy = [...activeGroups];
    copy.splice(idx + 1, 0, {
      ...src,
      id: undefined,
      localKey: `${src.code}-copy-${Date.now()}`,
      code: `${src.code}_copy`,
      label: `${src.label} (Copy)`,
      values: src.values.map((v) => ({ ...v, id: undefined })),
    });
    setActiveGroups(copy);
  }

  function updateGroup(idx: number, patch: Partial<EditableOptionGroup>) {
    setActiveGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function addOptionValue(groupIdx: number) {
    setActiveGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              values: [
                ...g.values,
                {
                  value: `choice_${g.values.length + 1}`,
                  label: `Choice ${g.values.length + 1}`,
                  swatchHex: g.type === "SWATCH" ? CUSTOMIZATION_SWATCH_FALLBACK : "",
                  swatchImageUrl: "",
                  priceAdjustmentType: "NONE",
                  priceAdjustmentValue: "0",
                  isAvailable: true,
                },
              ],
            }
          : g,
      ),
    );
  }

  function updateOptionValue(
    groupIdx: number,
    valIdx: number,
    patch: Partial<EditableOptionValue>,
  ) {
    setActiveGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              values: g.values.map((v, j) => (j === valIdx ? { ...v, ...patch } : v)),
            }
          : g,
      ),
    );
  }

  function removeOptionValue(groupIdx: number, valIdx: number) {
    setActiveGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, values: g.values.filter((_, j) => j !== valIdx) } : g,
      ),
    );
  }

  async function handleSaveCustomization() {
    if (!productId) return;
    setSaving(true);
    try {
      if (editScope === "category") {
        const res = await adminSaveCategoryCustomizationAction({
          categoryId,
          groups: toSubmissionGroups(categoryGroups),
        });
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        toast.success(`Saved default customization groups for "${categoryName}".`);
      }

      const prodRes = await adminSaveProductCustomizationAction({
        productId,
        enabled,
        inheritCategoryDefaults: inheritDefaults,
        minLeadTimeDays: minLeadTimeDays.trim() ? Number(minLeadTimeDays) : null,
        disclaimerText: disclaimerText.trim() || null,
        groups: toSubmissionGroups(productGroups),
      });
      if (!prodRes.ok) {
        toast.error(prodRes.error.message);
        return;
      }
      if (editScope === "product") {
        toast.success("Product customization configuration saved.");
      }
      await loadConfig(productId);
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyPreset() {
    if (!productId) return;
    setApplyingPreset(true);
    const targetId = editScope === "product" ? productId : categoryId;
    const res = await adminApplyCustomizationPresetAction({
      targetType: editScope,
      targetId,
      presetKey,
      replaceExisting: false,
    });
    setApplyingPreset(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`Applied "${presetKey}" preset.`);
    await loadConfig(productId);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-medium">Customization settings</h2>
            <CardDescription>
              Enable made-to-order customization options and indicative estimates on this piece.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {enabled && productSlug ? (
              <Button asChild type="button" variant="outline" size="sm">
                <Link href={`/products/${productSlug}/customize`} target="_blank">
                  Preview Customizer
                  <ExternalLink className="ml-1.5 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleSaveCustomization}
              disabled={saving}
              className="min-h-10"
            >
              {saving ? "Saving…" : "Save Customization Settings"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <label htmlFor="cust-allow-toggle" className="cursor-pointer pr-3">
                <span className="block text-sm font-medium text-foreground">
                  Allow Customization
                </span>
                <span className="block text-xs text-muted-foreground">
                  Displays the &ldquo;Customize&rdquo; action on storefront cards and PDP.
                </span>
              </label>
              <input
                id="cust-allow-toggle"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
            </div>

            <div className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <label htmlFor="cust-inherit-toggle" className="cursor-pointer pr-3">
                <span className="block text-sm font-medium text-foreground">
                  Inherit &ldquo;{categoryName}&rdquo; Defaults
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pull shared category groups ({categoryGroups.length}) unless overridden below.
                </span>
              </label>
              <input
                id="cust-inherit-toggle"
                type="checkbox"
                checked={inheritDefaults}
                onChange={(e) => setInheritDefaults(e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="cust-lead-time"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Estimated Crafting Days
              </label>
              <Input
                id="cust-lead-time"
                type="number"
                min={1}
                max={365}
                value={minLeadTimeDays}
                onChange={(e) => setMinLeadTimeDays(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="cust-disclaimer"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Estimate Disclaimer Note
              </label>
              <Input
                id="cust-disclaimer"
                value={disclaimerText}
                onChange={(e) => setDisclaimerText(e.target.value)}
                placeholder="Estimate shown; we confirm the final price in your quote."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editScope === "product" ? "primary" : "outline"}
              size="sm"
              onClick={() => setEditScope("product")}
            >
              Product Overrides ({productGroups.length})
            </Button>
            <Button
              type="button"
              variant={editScope === "category" ? "primary" : "outline"}
              size="sm"
              onClick={() => setEditScope("category")}
            >
              Category Defaults · {categoryName} ({categoryGroups.length})
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Category preset template"
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value as CustomizationPresetKey)}
              className="h-9 w-auto text-xs"
            >
              <option value="rings">Rings Preset</option>
              <option value="necklaces">Necklaces / Pendants Preset</option>
              <option value="earrings">Earrings Preset</option>
              <option value="bracelets">Bracelets Preset</option>
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={applyingPreset}
              onClick={handleApplyPreset}
            >
              <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
              {applyingPreset ? "Applying…" : "Add Preset Groups"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveGroups((prev) => [...prev, createEmptyGroup(prev.length)])}
            >
              <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
              Add Option Group
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No {editScope === "product" ? "product-specific override" : "category default"} groups
              defined yet. Click &ldquo;Add Preset Groups&rdquo; or &ldquo;Add Option Group&rdquo;
              to begin.
            </div>
          ) : (
            activeGroups.map((group, idx) => (
              <div
                key={group.localKey}
                className="space-y-4 rounded-lg border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={group.isActive ? "default" : "outline"}>
                      {group.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
                    <span className="text-sm font-semibold text-foreground">{group.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => moveGroup(idx, -1)}
                      aria-label="Move group up"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={idx === activeGroups.length - 1}
                      onClick={() => moveGroup(idx, 1)}
                      aria-label="Move group down"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateGroup(idx)}
                      aria-label="Duplicate group"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveGroups((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove group"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label
                      htmlFor={`${group.localKey}-label`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Group Label
                    </label>
                    <Input
                      id={`${group.localKey}-label`}
                      value={group.label}
                      onChange={(e) => updateGroup(idx, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${group.localKey}-code`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Machine Code
                    </label>
                    <Input
                      id={`${group.localKey}-code`}
                      value={group.code}
                      onChange={(e) => updateGroup(idx, { code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${group.localKey}-type`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Input Type
                    </label>
                    <NativeSelect
                      id={`${group.localKey}-type`}
                      value={group.type}
                      onChange={(e) =>
                        updateGroup(idx, {
                          type: e.target.value as CustomizationGroupTypeValue,
                        })
                      }
                    >
                      <option value="SELECT">Single Select</option>
                      <option value="MULTI_SELECT">Multi Select</option>
                      <option value="SWATCH">Color Swatch</option>
                      <option value="NUMBER_RANGE">Number / Carat Range</option>
                      <option value="TEXT">Short Text (Engraving)</option>
                      <option value="TEXTAREA">Long Notes</option>
                      <option value="IMAGE_UPLOAD">Reference Image Upload</option>
                    </NativeSelect>
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={group.required}
                        onChange={(e) => updateGroup(idx, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={group.isActive}
                        onChange={(e) => updateGroup(idx, { isActive: e.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor={`${group.localKey}-helper`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Helper Text
                    </label>
                    <Input
                      id={`${group.localKey}-helper`}
                      value={group.helperText}
                      onChange={(e) => updateGroup(idx, { helperText: e.target.value })}
                      placeholder="Guidance shown under the field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${group.localKey}-depends`}
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      Depends On Group Code (Optional)
                    </label>
                    <Input
                      id={`${group.localKey}-depends`}
                      value={group.dependsOnGroupCode}
                      onChange={(e) => updateGroup(idx, { dependsOnGroupCode: e.target.value })}
                      placeholder="e.g. stone_shape"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={group.requiresStone}
                        onChange={(e) => updateGroup(idx, { requiresStone: e.target.checked })}
                      />
                      Only when product carries a gemstone
                    </label>
                  </div>
                </div>

                {group.type === "NUMBER_RANGE" ? (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label
                        htmlFor={`${group.localKey}-min`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Min Value
                      </label>
                      <Input
                        id={`${group.localKey}-min`}
                        value={group.minValue}
                        onChange={(e) => updateGroup(idx, { minValue: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${group.localKey}-max`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Max Value
                      </label>
                      <Input
                        id={`${group.localKey}-max`}
                        value={group.maxValue}
                        onChange={(e) => updateGroup(idx, { maxValue: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${group.localKey}-step`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Step
                      </label>
                      <Input
                        id={`${group.localKey}-step`}
                        value={group.stepValue}
                        onChange={(e) => updateGroup(idx, { stepValue: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${group.localKey}-unit`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Unit (e.g. ct)
                      </label>
                      <Input
                        id={`${group.localKey}-unit`}
                        value={group.unit}
                        onChange={(e) => updateGroup(idx, { unit: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}

                {group.type === "TEXT" || group.type === "TEXTAREA" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${group.localKey}-maxlen`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Max Characters
                      </label>
                      <Input
                        id={`${group.localKey}-maxlen`}
                        type="number"
                        value={group.maxLength}
                        onChange={(e) => updateGroup(idx, { maxLength: e.target.value })}
                        placeholder="e.g. 24"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${group.localKey}-placeholder`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        Placeholder
                      </label>
                      <Input
                        id={`${group.localKey}-placeholder`}
                        value={group.placeholder}
                        onChange={(e) => updateGroup(idx, { placeholder: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}

                {group.type === "IMAGE_UPLOAD" ? (
                  <div className="max-w-xs">
                    <label
                      htmlFor={`${group.localKey}-maxfiles`}
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      Max Reference Images (1–5)
                    </label>
                    <Input
                      id={`${group.localKey}-maxfiles`}
                      type="number"
                      min={1}
                      max={5}
                      value={group.maxFiles || "5"}
                      onChange={(e) => updateGroup(idx, { maxFiles: e.target.value })}
                    />
                  </div>
                ) : null}

                {OPTION_CHOICE_TYPES.has(group.type) ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Option Choices ({group.values.length})
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOptionValue(idx)}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Add Choice
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {group.values.map((val, vIdx) => (
                        <div
                          key={`${group.localKey}-val-${vIdx}`}
                          className="grid items-center gap-2 rounded-md border border-border bg-card p-2 sm:grid-cols-12"
                        >
                          <div className="sm:col-span-3">
                            <Input
                              aria-label="Choice label"
                              placeholder="Display Label"
                              value={val.label}
                              onChange={(e) =>
                                updateOptionValue(idx, vIdx, { label: e.target.value })
                              }
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Input
                              aria-label="Choice key"
                              placeholder="value_key"
                              value={val.value}
                              onChange={(e) =>
                                updateOptionValue(idx, vIdx, { value: e.target.value })
                              }
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <NativeSelect
                              aria-label="Indicative price rule"
                              value={val.priceAdjustmentType}
                              onChange={(e) =>
                                updateOptionValue(idx, vIdx, {
                                  priceAdjustmentType: e.target.value as PriceAdjustmentTypeValue,
                                })
                              }
                            >
                              <option value="NONE">No Adj.</option>
                              <option value="FIXED">+ Fixed USD</option>
                              <option value="PERCENT">+ Percent %</option>
                            </NativeSelect>
                          </div>
                          <div className="sm:col-span-2">
                            <Input
                              aria-label="Adjustment amount"
                              placeholder="0"
                              value={val.priceAdjustmentValue}
                              onChange={(e) =>
                                updateOptionValue(idx, vIdx, {
                                  priceAdjustmentValue: e.target.value,
                                })
                              }
                            />
                          </div>
                          {group.type === "SWATCH" ? (
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <input
                                type="color"
                                aria-label="Swatch color"
                                value={
                                  /^#[0-9a-fA-F]{6}$/.test(val.swatchHex)
                                    ? val.swatchHex
                                    : CUSTOMIZATION_SWATCH_FALLBACK
                                }
                                onChange={(e) =>
                                  updateOptionValue(idx, vIdx, { swatchHex: e.target.value })
                                }
                                className="h-9 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                              />
                              <span
                                className="size-5 rounded-full border border-border"
                                style={{
                                  backgroundColor: val.swatchHex || CUSTOMIZATION_SWATCH_FALLBACK,
                                }}
                              />
                            </div>
                          ) : (
                            <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
                              <input
                                type="checkbox"
                                checked={val.isAvailable}
                                onChange={(e) =>
                                  updateOptionValue(idx, vIdx, {
                                    isAvailable: e.target.checked,
                                  })
                                }
                              />
                              Available
                            </label>
                          )}
                          <div className="flex justify-end sm:col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOptionValue(idx, vIdx)}
                              aria-label="Delete choice"
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {activeGroups.length > 0 ? (
            <div className="flex justify-end border-t border-border pt-4">
              <Button
                type="button"
                onClick={handleSaveCustomization}
                disabled={saving}
                className="min-h-10"
              >
                {saving ? "Saving…" : "Save Customization Settings"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export type { CustomizationOptionValueDTO };
