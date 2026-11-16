"use client";

import * as React from "react";
import Link from "next/link";
import { BackLink } from "@/components/shared/BackLink";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminProductCustomizationTab } from "@/components/admin/AdminProductCustomizationTab";
import { ProductDeleteDialog } from "@/components/admin/ProductDeleteDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { ImageUploadField, type UploadedImageResult } from "@/components/shared/ImageUploadField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import { computeProductSeoScore } from "@/lib/seo/audit";
import { IMAGE_VIEW_TYPES, buildAutoProductImageAlt } from "@/lib/seo/images";
import {
  DEFAULT_SEO_TEMPLATES,
  finalizeSeoDescription,
  finalizeSeoTitle,
  interpolateSeoTemplate,
} from "@/lib/seo/templates";
import {
  archiveProductAction,
  duplicateProductAction,
  upsertProductAction,
} from "@/modules/catalog/catalog.actions";
import type {
  AdminCategoryDTO,
  AdminFacetDTO,
  AdminProductDetailDTO,
} from "@/modules/catalog/catalog.service";

interface VariantDraft {
  id?: string;
  sku: string;
  title: string;
  size: string;
  metal: string;
  stoneSpec: string;
  priceOverride: string;
  compareAtOverride: string;
  initialStockQty: string;
  stockQty?: number;
  reservedQty?: number;
  lowStockThreshold: string;
  isDefault: boolean;
  isActive: boolean;
  weightGrams: string;
}

interface ImageDraft {
  id?: string;
  storageKey: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  avifUrl?: string | null;
  jpegUrl?: string | null;
  responsiveVariants?: Record<string, unknown> | null;
  altText: string;
  viewType: "front" | "side" | "detail" | "on-hand" | "lifestyle" | "packaging" | "certificate";
  title: string;
  caption: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

interface SeoFaqDraft {
  question: string;
  answer: string;
}

interface FacetDraft {
  facetId: string;
  optionId: string | null;
  valueText: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
}

interface ProductFormState {
  id?: string;
  sku: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId: string;
  subtitle: string;
  description: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  hasSizing: boolean;
  leadTimeDays: string;
  priceMode: "FIXED" | "PRICE_ON_REQUEST";
  basePrice: string;
  compareAtPrice: string;
  costPrice: string;
  metalType: string;
  metalColor: string;
  metalPurity: string;
  metalWeightGrams: string;
  stoneOrigin: string;
  stoneShape: string;
  caratTotal: string;
  caratCenter: string;
  colorGrade: string;
  clarityGrade: string;
  cutGrade: string;
  polishGrade: string;
  symmetryGrade: string;
  fluorescence: string;
  certificationLab: string;
  certificateNumber: string;
  certificateUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  canonicalOverride: string;
  noindex: boolean;
  warrantyText: string;
  salePriceStartAt: string;
  salePriceEndAt: string;
  seoFaqs: SeoFaqDraft[];
  gtin: string;
  mpn: string;
  googleProductCategory: string;
  variants: VariantDraft[];
  images: ImageDraft[];
  facetValues: FacetDraft[];
}

function buildInitialState(
  product: AdminProductDetailDTO | null,
  categories: AdminCategoryDTO[],
): ProductFormState {
  if (!product) {
    return {
      sku: "",
      name: "",
      slug: "",
      status: "DRAFT",
      categoryId: categories[0]?.id ?? "",
      subtitle: "",
      description: "",
      isFeatured: false,
      isNewArrival: true,
      isBestseller: false,
      hasSizing: false,
      leadTimeDays: "",
      priceMode: "FIXED",
      basePrice: "1500.00",
      compareAtPrice: "",
      costPrice: "",
      metalType: "GOLD_18K",
      metalColor: "Yellow Gold",
      metalPurity: "18K",
      metalWeightGrams: "",
      stoneOrigin: "NATURAL",
      stoneShape: "ROUND",
      caratTotal: "",
      caratCenter: "",
      colorGrade: "",
      clarityGrade: "",
      cutGrade: "",
      polishGrade: "",
      symmetryGrade: "",
      fluorescence: "",
      certificationLab: "GIA",
      certificateNumber: "",
      certificateUrl: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
      ogTitle: "",
      ogDescription: "",
      ogImageUrl: "",
      canonicalOverride: "",
      noindex: false,
      warrantyText: "",
      salePriceStartAt: "",
      salePriceEndAt: "",
      seoFaqs: [],
      gtin: "",
      mpn: "",
      googleProductCategory: "Apparel & Accessories > Jewelry",
      variants: [
        {
          sku: "",
          title: "Signature Edition",
          size: "",
          metal: "18K Yellow Gold",
          stoneSpec: "",
          priceOverride: "",
          compareAtOverride: "",
          initialStockQty: "1",
          lowStockThreshold: "2",
          isDefault: true,
          isActive: true,
          weightGrams: "",
        },
      ],
      images: [],
      facetValues: [],
    };
  }

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    status: product.status,
    categoryId: product.categoryId,
    subtitle: product.subtitle ?? "",
    description: product.description ?? "",
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    isBestseller: product.isBestseller,
    hasSizing: product.hasSizing,
    leadTimeDays: product.leadTimeDays !== null ? String(product.leadTimeDays) : "",
    priceMode: product.priceMode,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice ?? "",
    costPrice: product.costPrice ?? "",
    metalType: product.metalType ?? "",
    metalColor: product.metalColor ?? "",
    metalPurity: product.metalPurity ?? "",
    metalWeightGrams: product.metalWeightGrams ?? "",
    stoneOrigin: product.stoneOrigin ?? "",
    stoneShape: product.stoneShape ?? "",
    caratTotal: product.caratTotal ?? "",
    caratCenter: product.caratCenter ?? "",
    colorGrade: product.colorGrade ?? "",
    clarityGrade: product.clarityGrade ?? "",
    cutGrade: product.cutGrade ?? "",
    polishGrade: product.polishGrade ?? "",
    symmetryGrade: product.symmetryGrade ?? "",
    fluorescence: product.fluorescence ?? "",
    certificationLab: product.certificationLab ?? "",
    certificateNumber: product.certificateNumber ?? "",
    certificateUrl: product.certificateUrl ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    seoKeywords: product.seoKeywords ?? "",
    ogTitle: product.ogTitle ?? "",
    ogDescription: product.ogDescription ?? "",
    ogImageUrl: product.ogImageUrl ?? "",
    canonicalOverride: product.canonicalOverride ?? "",
    noindex: product.noindex,
    warrantyText: product.warrantyText ?? "",
    salePriceStartAt: product.salePriceStartAt ? product.salePriceStartAt.slice(0, 10) : "",
    salePriceEndAt: product.salePriceEndAt ? product.salePriceEndAt.slice(0, 10) : "",
    seoFaqs: product.seoFaqs ?? [],
    gtin: product.gtin ?? "",
    mpn: product.mpn ?? "",
    googleProductCategory: product.googleProductCategory ?? "",
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      size: v.size ?? "",
      metal: v.metal ?? "",
      stoneSpec: v.stoneSpec ?? "",
      priceOverride: v.priceOverride ?? "",
      compareAtOverride: v.compareAtOverride ?? "",
      initialStockQty: String(v.stockQty),
      stockQty: v.stockQty,
      reservedQty: v.reservedQty,
      lowStockThreshold: String(v.lowStockThreshold),
      isDefault: v.isDefault,
      isActive: v.isActive,
      weightGrams: v.weightGrams ?? "",
    })),
    images: product.images.map((i) => ({
      id: i.id,
      storageKey: i.storageKey,
      url: i.url,
      thumbUrl: i.thumbUrl ?? i.url,
      mediumUrl: i.mediumUrl ?? i.url,
      avifUrl: i.avifUrl ?? null,
      jpegUrl: i.jpegUrl ?? null,
      responsiveVariants: i.responsiveVariants ?? null,
      altText: i.altText,
      viewType: (i.viewType || "front") as ImageDraft["viewType"],
      title: i.title ?? "",
      caption: i.caption ?? "",
      width: i.width,
      height: i.height,
      isPrimary: i.isPrimary,
    })),
    facetValues: product.facetValues.map((fv) => ({
      facetId: fv.facetId,
      optionId: fv.optionId,
      valueText: fv.valueText,
      valueNumber: fv.valueNumber,
      valueBoolean: fv.valueBoolean,
    })),
  };
}

/** Suggested values; the storefront filters group products by these exact labels. */
const METAL_TYPE_SUGGESTIONS = [
  "925 Sterling Silver",
  "9K Yellow Gold",
  "9K White Gold",
  "9K Rose Gold",
  "10K Yellow Gold",
  "10K White Gold",
  "10K Rose Gold",
  "14K Yellow Gold",
  "14K White Gold",
  "14K Rose Gold",
  "18K Yellow Gold",
  "18K White Gold",
  "18K Rose Gold",
  "Platinum 950",
];
const STONE_ORIGIN_SUGGESTIONS = ["Moissanite", "Lab-Grown Diamond", "Cubic Zirconia"];

export function ProductEditor({
  product,
  categories,
  facets,
  siteName,
  siteUrl,
  canDelete,
}: {
  product: AdminProductDetailDTO | null;
  categories: AdminCategoryDTO[];
  facets: AdminFacetDTO[];
  siteName: string;
  siteUrl: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<ProductFormState>(() =>
    buildInitialState(product, categories),
  );
  const [savedSnapshot, setSavedSnapshot] = React.useState(() =>
    JSON.stringify(buildInitialState(product, categories)),
  );
  const currentSnapshot = React.useMemo(() => JSON.stringify(form), [form]);
  const isDirty = currentSnapshot !== savedSnapshot;
  const unsavedGuard = useUnsavedChangesGuard({ isDirty });

  const [activeTab, setActiveTab] = React.useState("overview");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const res = await upsertProductAction({
      id: form.id,
      sku: form.sku,
      name: form.name,
      slug: form.slug || null,
      status: form.status,
      categoryId: form.categoryId,
      subtitle: form.subtitle || null,
      description: form.description || null,
      isFeatured: form.isFeatured,
      isNewArrival: form.isNewArrival,
      isBestseller: form.isBestseller,
      hasSizing: form.hasSizing,
      leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
      priceMode: form.priceMode,
      basePrice: form.basePrice,
      compareAtPrice: form.compareAtPrice || null,
      costPrice: form.costPrice || null,
      metalType: form.metalType || null,
      metalColor: form.metalColor || null,
      metalPurity: form.metalPurity || null,
      metalWeightGrams: form.metalWeightGrams || null,
      stoneOrigin: form.stoneOrigin || null,
      stoneShape: form.stoneShape || null,
      caratTotal: form.caratTotal || null,
      caratCenter: form.caratCenter || null,
      colorGrade: form.colorGrade || null,
      clarityGrade: form.clarityGrade || null,
      cutGrade: form.cutGrade || null,
      polishGrade: form.polishGrade || null,
      symmetryGrade: form.symmetryGrade || null,
      fluorescence: form.fluorescence || null,
      certificationLab: form.certificationLab || null,
      certificateNumber: form.certificateNumber || null,
      certificateUrl: form.certificateUrl || null,
      variants: form.variants.map((v, idx) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        size: v.size || null,
        metal: v.metal || null,
        stoneSpec: v.stoneSpec || null,
        priceOverride: v.priceOverride || null,
        compareAtOverride: v.compareAtOverride || null,
        initialStockQty: Number(v.initialStockQty || "0"),
        lowStockThreshold: Number(v.lowStockThreshold || "2"),
        isDefault: v.isDefault,
        isActive: v.isActive,
        sortOrder: idx,
        weightGrams: v.weightGrams || null,
      })),
      images: form.images.map((img, idx) => ({
        id: img.id,
        storageKey: img.storageKey,
        url: img.url,
        thumbUrl: img.thumbUrl || null,
        mediumUrl: img.mediumUrl || null,
        avifUrl: img.avifUrl || null,
        jpegUrl: img.jpegUrl || null,
        responsiveVariants: img.responsiveVariants ?? undefined,
        altText: img.altText,
        viewType: (img.viewType || "front") as ImageDraft["viewType"],
        title: img.title || null,
        caption: img.caption || null,
        width: img.width,
        height: img.height,
        isPrimary: img.isPrimary,
        sortOrder: idx,
      })),
      facetValues: form.facetValues,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      seoKeywords: form.seoKeywords || null,
      ogTitle: form.ogTitle || null,
      ogDescription: form.ogDescription || null,
      ogImageUrl: form.ogImageUrl || null,
      canonicalOverride: form.canonicalOverride || null,
      noindex: form.noindex,
      warrantyText: form.warrantyText || null,
      salePriceStartAt: form.salePriceStartAt
        ? new Date(form.salePriceStartAt).toISOString()
        : null,
      salePriceEndAt: form.salePriceEndAt ? new Date(form.salePriceEndAt).toISOString() : null,
      seoFaqs: form.seoFaqs.filter((q) => q.question.trim() && q.answer.trim()),
      gtin: form.gtin || null,
      mpn: form.mpn || null,
      googleProductCategory: form.googleProductCategory || null,
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      if (res.error.fieldErrors?.images) setActiveTab("media");
      else if (res.error.fieldErrors?.variants) setActiveTab("variants");
      return;
    }

    unsavedGuard.markClean();
    setSavedSnapshot(currentSnapshot);
    toast.success(form.id ? "Product saved." : "Product created.");
    if (!form.id) {
      router.replace(`/admin/products/${res.data.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleArchive() {
    if (!form.id) return;
    setArchiving(true);
    const res = await archiveProductAction({ id: form.id });
    setArchiving(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    unsavedGuard.markClean();
    setSavedSnapshot(currentSnapshot);
    toast.success("Product archived.");
    router.push("/admin/products");
    router.refresh();
  }

  async function handleDuplicate() {
    if (!form.id) return;
    setDuplicating(true);
    const res = await duplicateProductAction({ id: form.id });
    setDuplicating(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    unsavedGuard.markClean();
    toast.success(`Duplicated "${form.name}" as a Draft copy.`);
    router.replace(`/admin/products/${res.data.id}`);
  }

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          sku: prev.sku ? `${prev.sku}-V${prev.variants.length + 1}` : "",
          title: `Edition ${prev.variants.length + 1}`,
          size: "",
          metal: prev.metalColor ? `${prev.metalPurity} ${prev.metalColor}`.trim() : "",
          stoneSpec: "",
          priceOverride: "",
          compareAtOverride: "",
          initialStockQty: "1",
          lowStockThreshold: "2",
          isDefault: prev.variants.length === 0,
          isActive: true,
          weightGrams: "",
        },
      ],
    }));
  }

  function setDefaultVariant(index: number) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, idx) => ({ ...v, isDefault: idx === index })),
    }));
  }

  function removeVariant(index: number) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
    }));
  }

  function appendUploadedImage(asset: UploadedImageResult) {
    setForm((prev) => {
      const viewType = prev.images.length === 0 ? "front" : "detail";
      return {
        ...prev,
        images: [
          ...prev.images,
          {
            storageKey: asset.storageKey,
            url: asset.url,
            thumbUrl: asset.thumbUrl,
            mediumUrl: asset.mediumUrl,
            avifUrl: asset.avifUrl ?? null,
            jpegUrl: asset.jpegUrl ?? null,
            responsiveVariants: asset.responsiveVariants ?? null,
            altText: buildAutoProductImageAlt({
              productName: prev.name || "Jewelry piece",
              metal: prev.metalType || null,
              carat: prev.caratTotal || null,
              shape: prev.stoneShape || null,
              cert: prev.certificationLab || null,
              viewType,
            }),
            viewType: viewType as ImageDraft["viewType"],
            title: "",
            caption: "",
            width: asset.width,
            height: asset.height,
            isPrimary: prev.images.length === 0,
          },
        ],
      };
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setForm((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.images.length) return prev;
      const copy = [...prev.images];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item!);
      return { ...prev, images: copy };
    });
  }

  function setPrimaryImage(index: number) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, idx) => ({ ...img, isPrimary: idx === index })),
    }));
  }

  function removeImage(index: number) {
    setForm((prev) => {
      const remaining = prev.images.filter((_, idx) => idx !== index);
      if (remaining.length > 0 && !remaining.some((i) => i.isPrimary)) {
        remaining[0] = { ...remaining[0]!, isPrimary: true };
      }
      return { ...prev, images: remaining };
    });
  }

  function hasFacetOption(facetId: string, optionId: string) {
    return form.facetValues.some((fv) => fv.facetId === facetId && fv.optionId === optionId);
  }

  function toggleFacetOption(facetId: string, optionId: string) {
    setForm((prev) => {
      const exists = prev.facetValues.some(
        (fv) => fv.facetId === facetId && fv.optionId === optionId,
      );
      return {
        ...prev,
        facetValues: exists
          ? prev.facetValues.filter((fv) => !(fv.facetId === facetId && fv.optionId === optionId))
          : [
              ...prev.facetValues,
              { facetId, optionId, valueText: null, valueNumber: null, valueBoolean: null },
            ],
      };
    });
  }

  function setScalarFacet(
    facetId: string,
    patch: Partial<Pick<FacetDraft, "valueNumber" | "valueBoolean" | "valueText">>,
  ) {
    setForm((prev) => {
      const others = prev.facetValues.filter((fv) => fv.facetId !== facetId);
      const existing = prev.facetValues.find((fv) => fv.facetId === facetId);
      const nextValue: FacetDraft = {
        facetId,
        optionId: null,
        valueText: patch.valueText !== undefined ? patch.valueText : (existing?.valueText ?? null),
        valueNumber:
          patch.valueNumber !== undefined ? patch.valueNumber : (existing?.valueNumber ?? null),
        valueBoolean:
          patch.valueBoolean !== undefined ? patch.valueBoolean : (existing?.valueBoolean ?? null),
      };
      return {
        ...prev,
        facetValues: [...others, nextValue],
      };
    });
  }

  const selectedCategoryName =
    categories.find((c) => c.id === form.categoryId)?.name ?? "Fine Jewelry";
  const generatedSeoTitle = finalizeSeoTitle(
    interpolateSeoTemplate(DEFAULT_SEO_TEMPLATES.productTitle, {
      name: form.name || "Untitled Fine Piece",
      category: selectedCategoryName,
      collection: selectedCategoryName,
      metal: form.metalType || form.stoneShape || null,
      carat: form.caratTotal || null,
      cert: form.certificationLab ? `${form.certificationLab} Certified` : null,
      brand: siteName,
    }),
    { brandName: siteName, maxLength: 60 },
  );
  const generatedSeoDesc = finalizeSeoDescription(
    form.subtitle || form.description || form.name,
    `Handmade jewelry by ${siteName}.`,
  );

  const serpTitle = form.seoTitle || generatedSeoTitle;
  const serpUrl = `${siteUrl.replace(/\/+$/, "")}/products/${form.slug || "product-slug"}`;
  const serpDescription = form.seoDescription || generatedSeoDesc;

  const seoScoreResult = computeProductSeoScore({
    name: form.name,
    slug: form.slug || "product-slug",
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    resolvedTitle: serpTitle,
    resolvedDescription: serpDescription,
    seoKeywords: form.seoKeywords,
    primaryImageUrl: form.images[0]?.url,
    primaryImageWidth: form.images[0]?.width,
    primaryImageHeight: form.images[0]?.height,
    primaryAltText: form.images[0]?.altText,
    imageCount: form.images.length,
    hasSpecs: Boolean(form.metalType || form.caratTotal || form.certificationLab),
  });

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <BackLink
            fallbackHref="/admin/products"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to Products</span>
          </BackLink>
          <h1 className="font-display text-3xl font-medium text-foreground">
            {form.id ? form.name || "Edit Product" : "New product"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit pricing, stone details, sizes, photos, filters and SEO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {form.id && (
            <>
              <Button
                type="button"
                variant="outline"
                loading={duplicating}
                onClick={() => void handleDuplicate()}
                className="gap-1.5"
              >
                <Copy className="size-4" aria-hidden="true" />
                <span>Duplicate</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveOpen(true)}
                className="gap-1.5"
              >
                <span>Archive</span>
              </Button>
            </>
          )}
          {form.id && canDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-1.5 text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>Delete Permanently</span>
            </Button>
          )}
          <Button type="submit" loading={saving} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            <span>{form.id ? "Save Product" : "Create Product"}</span>
          </Button>
        </div>
      </div>

      {Object.keys(fieldErrors).length > 0 && (
        <div
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Please address the highlighted validation errors:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {Object.entries(fieldErrors).map(([key, msgs]) => (
              <li key={key}>
                <span className="font-mono">{key}</span>: {msgs.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">1. Overview</TabsTrigger>
          <TabsTrigger value="pricing">2. Pricing</TabsTrigger>
          <TabsTrigger value="specs">3. Metal &amp; stone</TabsTrigger>
          <TabsTrigger value="variants">4. Variants ({form.variants.length})</TabsTrigger>
          <TabsTrigger value="media">5. Media ({form.images.length})</TabsTrigger>
          <TabsTrigger value="facets">6. Facets</TabsTrigger>
          <TabsTrigger value="seo">7. SEO &amp; Feeds</TabsTrigger>
          <TabsTrigger value="customization">8. Customization</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Overview</h2>
              <CardDescription>
                Core identity, category assignment, URL slug, and storefront merchandising badges.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="prod-name"
                  label="Product Title"
                  required
                  error={fieldErrors.name?.[0]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Celeste Oval Solitaire Ring"
                      required
                    />
                  )}
                </FormField>

                <FormField id="prod-sku" label="Master SKU" required error={fieldErrors.sku?.[0]}>
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                      placeholder="MA-RNG-SOL-001"
                      required
                    />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  id="prod-slug"
                  label="URL Slug"
                  hint="Blank derives from title; rename creates 301 redirect"
                  error={fieldErrors.slug?.[0]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="celeste-oval-solitaire-ring"
                    />
                  )}
                </FormField>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="prod-category">Category</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}
                  >
                    <SelectTrigger id="prod-category">
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} (/collections/{cat.path})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="prod-status">Publication Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        status: value as ProductFormState["status"],
                      }))
                    }
                  >
                    <SelectTrigger id="prod-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active (Storefront Visible)</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <FormField id="prod-subtitle" label="Subtitle">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.subtitle}
                        onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                        placeholder="e.g. 2 ct oval moissanite, hidden halo"
                      />
                    )}
                  </FormField>
                </div>

                <FormField id="prod-lead" label="Lead Time (Days)">
                  {(aria) => (
                    <Input
                      {...aria}
                      type="number"
                      min={0}
                      max={365}
                      value={form.leadTimeDays}
                      onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                      placeholder="10"
                    />
                  )}
                </FormField>
              </div>

              <FormField id="prod-desc" label="Piece Description">
                {(aria) => (
                  <Textarea
                    {...aria}
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe craftsmanship, proportions, setting architecture, and provenance..."
                  />
                )}
              </FormField>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                  <Label htmlFor="prod-featured" className="cursor-pointer">
                    Featured Piece
                  </Label>
                  <Switch
                    id="prod-featured"
                    checked={form.isFeatured}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                  <Label htmlFor="prod-new" className="cursor-pointer">
                    New Arrival
                  </Label>
                  <Switch
                    id="prod-new"
                    checked={form.isNewArrival}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isNewArrival: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                  <Label htmlFor="prod-bestseller" className="cursor-pointer">
                    Bestseller
                  </Label>
                  <Switch
                    id="prod-bestseller"
                    checked={form.isBestseller}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isBestseller: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                  <Label htmlFor="prod-sizing" className="cursor-pointer">
                    Requires Ring Sizing
                  </Label>
                  <Switch
                    id="prod-sizing"
                    checked={form.hasSizing}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, hasSizing: v }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Pricing */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Pricing &amp; Valuation</h2>
              <CardDescription>
                Server-authoritative base pricing. Select &ldquo;Price on Request&rdquo; for High
                Jewelry sold by quote only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-1.5 sm:max-w-xs">
                <Label htmlFor="prod-pricemode">Pricing Mode</Label>
                <Select
                  value={form.priceMode}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priceMode: v as ProductFormState["priceMode"] }))
                  }
                >
                  <SelectTrigger id="prod-pricemode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed Retail Price</SelectItem>
                    <SelectItem value="PRICE_ON_REQUEST">Price on Request (Inquiry)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  id="prod-baseprice"
                  label="Base Retail Price"
                  required
                  error={fieldErrors.basePrice?.[0]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.basePrice}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                      placeholder="4200.00"
                      required
                    />
                  )}
                </FormField>

                <FormField
                  id="prod-compareprice"
                  label="Compare-At Price (Optional)"
                  error={fieldErrors.compareAtPrice?.[0]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.compareAtPrice}
                      onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))}
                      placeholder="4650.00"
                    />
                  )}
                </FormField>

                <FormField
                  id="prod-costprice"
                  label="Internal Cost Price (Private)"
                  hint="Never exposed on storefront or public JSON"
                  error={fieldErrors.costPrice?.[0]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.costPrice}
                      onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                      placeholder="2100.00"
                    />
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Metal & Diamond 4Cs */}
        <TabsContent value="specs">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Metal &amp; stone details</h2>
              <CardDescription>
                Details shown on the product page, in Google Shopping and collection filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <datalist id="spec-metal-options">
                {METAL_TYPE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <datalist id="spec-stone-options">
                {STONE_ORIGIN_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField id="spec-mtype" label="Metal Type">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.metalType}
                      onChange={(e) => setForm((f) => ({ ...f, metalType: e.target.value }))}
                      placeholder="925 Sterling Silver"
                      list="spec-metal-options"
                    />
                  )}
                </FormField>
                <FormField id="spec-mcolor" label="Metal Color">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.metalColor}
                      onChange={(e) => setForm((f) => ({ ...f, metalColor: e.target.value }))}
                      placeholder="Yellow Gold"
                    />
                  )}
                </FormField>
                <FormField id="spec-mpurity" label="Metal Purity">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.metalPurity}
                      onChange={(e) => setForm((f) => ({ ...f, metalPurity: e.target.value }))}
                      placeholder="925 / 9K / 14K / PT950"
                    />
                  )}
                </FormField>
                <FormField id="spec-mweight" label="Metal Weight (grams)">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.metalWeightGrams}
                      onChange={(e) => setForm((f) => ({ ...f, metalWeightGrams: e.target.value }))}
                      placeholder="4.20"
                    />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField id="spec-sorigin" label="Stone Origin">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.stoneOrigin}
                      onChange={(e) => setForm((f) => ({ ...f, stoneOrigin: e.target.value }))}
                      placeholder="Moissanite"
                      list="spec-stone-options"
                    />
                  )}
                </FormField>
                <FormField id="spec-sshape" label="Stone Shape">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.stoneShape}
                      onChange={(e) => setForm((f) => ({ ...f, stoneShape: e.target.value }))}
                      placeholder="OVAL / ROUND / EMERALD"
                    />
                  )}
                </FormField>
                <FormField id="spec-cttotal" label="Total Carat Weight (ct)">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.caratTotal}
                      onChange={(e) => setForm((f) => ({ ...f, caratTotal: e.target.value }))}
                      placeholder="1.80"
                    />
                  )}
                </FormField>
                <FormField id="spec-ctcenter" label="Center Carat Weight (ct)">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.caratCenter}
                      onChange={(e) => setForm((f) => ({ ...f, caratCenter: e.target.value }))}
                      placeholder="1.50"
                    />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <FormField id="spec-color" label="Color Grade">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.colorGrade}
                      onChange={(e) => setForm((f) => ({ ...f, colorGrade: e.target.value }))}
                      placeholder="E"
                    />
                  )}
                </FormField>
                <FormField id="spec-clarity" label="Clarity Grade">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.clarityGrade}
                      onChange={(e) => setForm((f) => ({ ...f, clarityGrade: e.target.value }))}
                      placeholder="VVS2"
                    />
                  )}
                </FormField>
                <FormField id="spec-cut" label="Cut Grade">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.cutGrade}
                      onChange={(e) => setForm((f) => ({ ...f, cutGrade: e.target.value }))}
                      placeholder="Ideal"
                    />
                  )}
                </FormField>
                <FormField id="spec-polish" label="Polish">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.polishGrade}
                      onChange={(e) => setForm((f) => ({ ...f, polishGrade: e.target.value }))}
                      placeholder="Excellent"
                    />
                  )}
                </FormField>
                <FormField id="spec-symmetry" label="Symmetry">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.symmetryGrade}
                      onChange={(e) => setForm((f) => ({ ...f, symmetryGrade: e.target.value }))}
                      placeholder="Excellent"
                    />
                  )}
                </FormField>
                <FormField id="spec-fluor" label="Fluorescence">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.fluorescence}
                      onChange={(e) => setForm((f) => ({ ...f, fluorescence: e.target.value }))}
                      placeholder="None"
                    />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="spec-lab" label="Certification Lab">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.certificationLab}
                      onChange={(e) => setForm((f) => ({ ...f, certificationLab: e.target.value }))}
                      placeholder="GIA / IGI"
                    />
                  )}
                </FormField>
                <FormField id="spec-certnum" label="Certificate Number">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.certificateNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, certificateNumber: e.target.value }))
                      }
                      placeholder="GIA-248195221"
                    />
                  )}
                </FormField>
                <FormField id="spec-certurl" label="Verification URL">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.certificateUrl}
                      onChange={(e) => setForm((f) => ({ ...f, certificateUrl: e.target.value }))}
                      placeholder="https://www.gia.edu/report-check"
                    />
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Variants */}
        <TabsContent value="variants">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-medium">Product Variants</h2>
                <CardDescription>
                  Initial stock sets opening balance for new variants. Existing variant stock
                  quantities are adjusted atomically in the Inventory Ledger.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="size-4" aria-hidden="true" />
                <span>Add Variant</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.variants.map((v, idx) => (
                <div
                  key={v.id ?? `new-${idx}`}
                  className="space-y-4 rounded-md border border-border bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={v.isDefault ? "primary" : "outline"}>
                        {v.isDefault ? "Default Variant" : `Variant ${idx + 1}`}
                      </Badge>
                      {v.id && (
                        <Badge variant="default">
                          On-hand: {v.stockQty ?? 0} · Reserved: {v.reservedQty ?? 0}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!v.isDefault && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultVariant(idx)}
                        >
                          Set Default
                        </Button>
                      )}
                      {form.variants.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(idx)}
                          className="text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label htmlFor={`var-title-${idx}`} className="text-xs">
                        Title *
                      </Label>
                      <Input
                        id={`var-title-${idx}`}
                        value={v.title}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, title: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`var-sku-${idx}`} className="text-xs">
                        Variant SKU *
                      </Label>
                      <Input
                        id={`var-sku-${idx}`}
                        value={v.sku}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, sku: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`var-size-${idx}`} className="text-xs">
                        Size / Length
                      </Label>
                      <Input
                        id={`var-size-${idx}`}
                        value={v.size}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, size: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                        placeholder="US 6 / 16 in"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`var-metal-${idx}`} className="text-xs">
                        Metal Finish
                      </Label>
                      <Input
                        id={`var-metal-${idx}`}
                        value={v.metal}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, metal: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                        placeholder="18K Yellow Gold"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label htmlFor={`var-price-${idx}`} className="text-xs">
                        Price Override
                      </Label>
                      <Input
                        id={`var-price-${idx}`}
                        value={v.priceOverride}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, priceOverride: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                        placeholder="Optional override"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`var-low-${idx}`} className="text-xs">
                        Low-Stock Alert Threshold
                      </Label>
                      <Input
                        id={`var-low-${idx}`}
                        type="number"
                        min={0}
                        value={v.lowStockThreshold}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, lowStockThreshold: e.target.value };
                            return { ...f, variants: next };
                          })
                        }
                      />
                    </div>

                    {!v.id ? (
                      <div>
                        <Label htmlFor={`var-init-${idx}`} className="text-xs">
                          Opening Stock Quantity
                        </Label>
                        <Input
                          id={`var-init-${idx}`}
                          type="number"
                          min={0}
                          value={v.initialStockQty}
                          onChange={(e) =>
                            setForm((f) => {
                              const next = [...f.variants];
                              next[idx] = { ...next[idx]!, initialStockQty: e.target.value };
                              return { ...f, variants: next };
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`}>
                            Adjust Stock in Ledger
                          </Link>
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card px-3 py-2">
                      <Label htmlFor={`var-active-${idx}`} className="cursor-pointer text-xs">
                        Variant Active
                      </Label>
                      <Switch
                        id={`var-active-${idx}`}
                        checked={v.isActive}
                        onCheckedChange={(checked) =>
                          setForm((f) => {
                            const next = [...f.variants];
                            next[idx] = { ...next[idx]!, isActive: checked };
                            return { ...f, variants: next };
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Media & Alt Text */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">
                Gallery Media &amp; Accessible Alt Text
              </h2>
              <CardDescription>
                Images are validated by magic bytes, stripped of EXIF GPS data, and converted to
                WebP. Descriptive alt text is required for every image.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUploadField
                id="prod-media-upload"
                folder="products"
                label="Upload Product Photograph"
                onUploaded={appendUploadedImage}
              />

              {form.images.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No images attached yet. Active products require at least one uploaded photograph.
                </p>
              ) : (
                <div className="space-y-3">
                  {form.images.map((img, idx) => (
                    <div
                      key={`${img.storageKey}-${idx}`}
                      className="flex flex-col gap-4 rounded-md border border-border bg-card p-3.5 sm:flex-row sm:items-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.thumbUrl || img.url}
                        alt={img.altText || "Uploaded jewelry photo"}
                        className="size-20 shrink-0 rounded-sm border border-border object-cover"
                      />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {img.isPrimary ? (
                            <Badge variant="primary">Primary Image</Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPrimaryImage(idx)}
                              className="min-h-11 gap-1.5 px-3 text-xs sm:min-h-8 sm:px-2"
                            >
                              <Star className="size-3" aria-hidden="true" />
                              <span>Set Primary</span>
                            </Button>
                          )}
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {img.width}x{img.height}
                          </span>
                        </div>

                        <div>
                          <Label htmlFor={`img-alt-${idx}`} className="text-xs">
                            Accessible Image Alt Text * ({img.altText.length}/125)
                          </Label>
                          <Input
                            id={`img-alt-${idx}`}
                            value={img.altText}
                            onChange={(e) =>
                              setForm((f) => {
                                const next = [...f.images];
                                next[idx] = { ...next[idx]!, altText: e.target.value };
                                return { ...f, images: next };
                              })
                            }
                            placeholder="18k gold oval solitaire diamond ring, front view"
                            required
                          />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <Label htmlFor={`img-view-${idx}`} className="text-xs">
                              Image View Type
                            </Label>
                            <NativeSelect
                              id={`img-view-${idx}`}
                              value={img.viewType || "front"}
                              onChange={(e) =>
                                setForm((f) => {
                                  const next = [...f.images];
                                  next[idx] = {
                                    ...next[idx]!,
                                    viewType: e.target.value as ImageDraft["viewType"],
                                  };
                                  return { ...f, images: next };
                                })
                              }
                            >
                              {IMAGE_VIEW_TYPES.map((vt) => (
                                <option key={vt} value={vt}>
                                  {vt}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                          <div>
                            <Label htmlFor={`img-title-${idx}`} className="text-xs">
                              Image Title (Schema)
                            </Label>
                            <Input
                              id={`img-title-${idx}`}
                              value={img.title}
                              placeholder="Optional image title"
                              onChange={(e) =>
                                setForm((f) => {
                                  const next = [...f.images];
                                  next[idx] = { ...next[idx]!, title: e.target.value };
                                  return { ...f, images: next };
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor={`img-cap-${idx}`} className="text-xs">
                              Image Caption
                            </Label>
                            <Input
                              id={`img-cap-${idx}`}
                              value={img.caption}
                              placeholder="Editorial / craft caption"
                              onChange={(e) =>
                                setForm((f) => {
                                  const next = [...f.images];
                                  next[idx] = { ...next[idx]!, caption: e.target.value };
                                  return { ...f, images: next };
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Move image ${idx + 1} earlier`}
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === form.images.length - 1}
                          aria-label={`Move image ${idx + 1} later`}
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeImage(idx)}
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Facets */}
        <TabsContent value="facets">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-medium">Collection Filter Facets</h2>
              <CardDescription>
                Add filterable attributes so shoppers can narrow down collections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {facets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attributes configured yet. Create facets under Admin &rarr; Attributes.
                </p>
              ) : (
                facets.map((facet) => {
                  const currentScalar = form.facetValues.find((fv) => fv.facetId === facet.id);
                  return (
                    <div key={facet.id} className="space-y-3 rounded-sm border border-border p-4">
                      <div>
                        <p className="font-medium text-foreground">{facet.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {facet.code} ({facet.valueType}
                          {facet.unit ? `, ${facet.unit}` : ""})
                        </p>
                      </div>

                      {facet.options.length > 0 ? (
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {facet.options.map((opt) => {
                            const checkId = `prod-facet-${facet.id}-${opt.id}`;
                            return (
                              <div key={opt.id} className="flex items-center gap-2.5">
                                <Checkbox
                                  id={checkId}
                                  checked={hasFacetOption(facet.id, opt.id)}
                                  onCheckedChange={() => toggleFacetOption(facet.id, opt.id)}
                                />
                                <Label htmlFor={checkId} className="cursor-pointer font-normal">
                                  {opt.label}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      ) : facet.valueType === "BOOLEAN" ? (
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`facet-bool-${facet.id}`}
                            checked={Boolean(currentScalar?.valueBoolean)}
                            onCheckedChange={(checked) =>
                              setScalarFacet(facet.id, { valueBoolean: checked })
                            }
                          />
                          <Label htmlFor={`facet-bool-${facet.id}`}>Enabled</Label>
                        </div>
                      ) : (
                        <div className="max-w-xs">
                          <Label htmlFor={`facet-num-${facet.id}`} className="text-xs">
                            Value {facet.unit ? `(${facet.unit})` : ""}
                          </Label>
                          <Input
                            id={`facet-num-${facet.id}`}
                            value={currentScalar?.valueNumber ?? currentScalar?.valueText ?? ""}
                            onChange={(e) =>
                              facet.valueType === "NUMBER" || facet.valueType === "RANGE"
                                ? setScalarFacet(facet.id, {
                                    valueNumber: e.target.value || null,
                                  })
                                : setScalarFacet(facet.id, { valueText: e.target.value || null })
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: SEO & Feeds */}
        <TabsContent value="seo">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-medium">
                    Search Metadata, FAQs &amp; Google Merchant Feed
                  </h2>
                  <CardDescription>
                    Tailor organic snippets, social OpenGraph cards, sale validity, warranty text,
                    and product FAQs.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      seoTitle: generatedSeoTitle,
                      seoDescription: generatedSeoDesc,
                    }))
                  }
                >
                  <Sparkles className="mr-1.5 size-4" aria-hidden="true" />
                  Generate from template
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  id="seo-title"
                  label="Custom SEO Title"
                  hint={`${(form.seoTitle || serpTitle).length}/60 characters recommended`}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      value={form.seoTitle}
                      onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                      placeholder={serpTitle}
                    />
                  )}
                </FormField>

                <FormField
                  id="seo-desc"
                  label="Meta Description"
                  hint={`${(form.seoDescription || serpDescription).length}/158 characters recommended`}
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      rows={3}
                      value={form.seoDescription}
                      onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                      placeholder={serpDescription}
                    />
                  )}
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="seo-keywords" label="Focus & Semantic Keywords">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.seoKeywords}
                        onChange={(e) => setForm((f) => ({ ...f, seoKeywords: e.target.value }))}
                        placeholder="emerald cut solitaire ring, platinum 950, gia diamond"
                      />
                    )}
                  </FormField>
                  <FormField
                    id="seo-warranty"
                    label="Warranty & Lifetime Care Summary (Schema + Visible FAQ)"
                  >
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.warrantyText}
                        onChange={(e) => setForm((f) => ({ ...f, warrantyText: e.target.value }))}
                        placeholder="Lifetime prong inspection, ultrasonic polishing & manufacturing warranty."
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="seo-og-title" label="OpenGraph / Social Title Override">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.ogTitle}
                        onChange={(e) => setForm((f) => ({ ...f, ogTitle: e.target.value }))}
                        placeholder={serpTitle}
                      />
                    )}
                  </FormField>
                  <FormField id="seo-og-desc" label="OpenGraph / Social Description Override">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.ogDescription}
                        onChange={(e) => setForm((f) => ({ ...f, ogDescription: e.target.value }))}
                        placeholder={serpDescription}
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="seo-sale-start" label="Sale Price Valid From (Merchant + Schema)">
                    {(aria) => (
                      <Input
                        {...aria}
                        type="date"
                        value={form.salePriceStartAt}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, salePriceStartAt: e.target.value }))
                        }
                      />
                    )}
                  </FormField>
                  <FormField id="seo-sale-end" label="Sale Price Valid Until">
                    {(aria) => (
                      <Input
                        {...aria}
                        type="date"
                        value={form.salePriceEndAt}
                        onChange={(e) => setForm((f) => ({ ...f, salePriceEndAt: e.target.value }))}
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="seo-canon" label="Canonical Override URL">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.canonicalOverride}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, canonicalOverride: e.target.value }))
                        }
                        placeholder="Optional absolute canonical URL"
                      />
                    )}
                  </FormField>
                  <FormField id="seo-og" label="Custom OG Image URL">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.ogImageUrl}
                        onChange={(e) => setForm((f) => ({ ...f, ogImageUrl: e.target.value }))}
                        placeholder="Defaults to primary product image"
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="seo-gtin" label="GTIN / UPC / EAN">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.gtin}
                        onChange={(e) => setForm((f) => ({ ...f, gtin: e.target.value }))}
                      />
                    )}
                  </FormField>
                  <FormField id="seo-mpn" label="MPN">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.mpn}
                        onChange={(e) => setForm((f) => ({ ...f, mpn: e.target.value }))}
                      />
                    )}
                  </FormField>
                  <FormField id="seo-gcat" label="Google Product Category">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={form.googleProductCategory}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, googleProductCategory: e.target.value }))
                        }
                      />
                    )}
                  </FormField>
                </div>

                <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                  <div>
                    <Label htmlFor="seo-noindex" className="cursor-pointer">
                      Exclude from Search Indexing (noindex)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent search bots and sitemaps from listing this piece even when Active.
                    </p>
                  </div>
                  <Switch
                    id="seo-noindex"
                    checked={form.noindex}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, noindex: v }))}
                  />
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Product-Specific FAQs (Visible + FAQPage JSON-LD)
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          seoFaqs: [...f.seoFaqs, { question: "", answer: "" }],
                        }))
                      }
                    >
                      <Plus className="mr-1 size-3.5" aria-hidden="true" />
                      Add FAQ
                    </Button>
                  </div>
                  {form.seoFaqs.map((faq, idx) => (
                    <div key={idx} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          placeholder="Question (e.g., Does this setting sit flush with a wedding band?)"
                          value={faq.question}
                          onChange={(e) =>
                            setForm((f) => {
                              const next = [...f.seoFaqs];
                              next[idx] = { ...next[idx]!, question: e.target.value };
                              return { ...f, seoFaqs: next };
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              seoFaqs: f.seoFaqs.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label="Remove FAQ"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Concise, verifiable answer shown in Initial HTML & FAQ schema"
                        value={faq.answer}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.seoFaqs];
                            next[idx] = { ...next[idx]!, answer: e.target.value };
                            return { ...f, seoFaqs: next };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-medium">
                      SEO Score &amp; SERP Preview
                    </h2>
                    <Badge variant={seoScoreResult.score >= 80 ? "success" : "warning"}>
                      {seoScoreResult.score}/100
                    </Badge>
                  </div>
                  <CardDescription>Live Google snippet &amp; quality diagnostics.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 rounded-sm border border-border bg-background p-4">
                    <p className="truncate text-xs text-accent-text">{serpUrl}</p>
                    <p className="line-clamp-2 font-display text-lg font-medium text-foreground">
                      {serpTitle}
                    </p>
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {serpDescription}
                    </p>
                  </div>

                  {seoScoreResult.items.some((i) => !i.passed) && (
                    <ul className="space-y-1 rounded-sm border border-border bg-surface p-3 text-xs text-muted-foreground">
                      {seoScoreResult.items
                        .filter((i) => !i.passed)
                        .map((item) => (
                          <li key={item.id}>
                            • {item.label}: {item.detail}
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold">Social / OpenGraph Card Preview</h3>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-md border border-border bg-background">
                    {(form.ogImageUrl || form.images[0]?.url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.ogImageUrl || form.images[0]?.url}
                        alt={form.name || "Social preview"}
                        className="aspect-[1.91/1] w-full object-cover"
                      />
                    )}
                    <div className="space-y-1 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase">{siteName}</p>
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {form.ogTitle || serpTitle}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {form.ogDescription || serpDescription}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 8: Customization */}
        <TabsContent value="customization">
          <AdminProductCustomizationTab productId={form.id} productSlug={form.slug} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive Product"
        description={`Soft-delete and archive "${form.name}"? Orders referencing its historical variants stay intact.`}
        confirmLabel="Archive Product"
        destructive
        loading={archiving}
        onConfirm={handleArchive}
      />

      <ProductDeleteDialog
        target={deleteDialogOpen && form.id ? { id: form.id, name: form.name } : null}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={() => {
          unsavedGuard.markClean();
          router.replace("/admin/products");
          router.refresh();
        }}
        onArchived={() => {
          unsavedGuard.markClean();
          router.replace("/admin/products");
          router.refresh();
        }}
      />

      {unsavedGuard.dialog}
    </form>
  );
}
