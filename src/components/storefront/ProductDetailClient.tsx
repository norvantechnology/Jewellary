"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Price } from "@/components/shared/Price";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { EnquiryForm } from "@/components/storefront/EnquiryForm";
import { WishlistToggleButton } from "@/components/storefront/WishlistToggleButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addToCartAction } from "@/modules/cart/cart.actions";
import type { PublicProductDetailDTO } from "@/modules/catalog/catalog.public";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface ProductDetailClientProps {
  product: PublicProductDetailDTO;
  currency: string;
  freeShippingThreshold: string | null;
  signatureThreshold: string;
  returnWindowDays: number;
}

export function ProductDetailClient({
  product,
  currency,
  freeShippingThreshold,
  signatureThreshold,
  returnWindowDays,
}: ProductDetailClientProps) {
  const router = useRouter();
  const initialVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;

  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(
    initialVariant?.id ?? null,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [addingToBag, setAddingToBag] = React.useState(false);
  const [enquiryOpen, setEnquiryOpen] = React.useState(false);

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? initialVariant;

  const availableStock = selectedVariant?.availableStock ?? 0;
  const maxSelectableQty = Math.min(10, Math.max(1, availableStock));
  const safeQuantity = Math.min(quantity, maxSelectableQty);

  async function handleAddToBag() {
    if (!selectedVariant || product.priceMode !== "FIXED" || availableStock <= 0) {
      return;
    }

    setAddingToBag(true);
    const result = await addToCartAction({
      variantId: selectedVariant.id,
      quantity: safeQuantity,
    });
    setAddingToBag(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    visitorStore.setBagCount(result.data.itemCount);
    toast.success(`${product.name} (${selectedVariant.title}) added to bag.`, {
      action: {
        label: "View Bag",
        onClick: () => router.push("/cart"),
      },
    });
  }

  const specRows: Array<{ label: string; value: string }> = [];
  if (product.metalType) {
    specRows.push({
      label: "Precious Metal",
      value: [product.metalPurity, product.metalType].filter(Boolean).join(" "),
    });
  }
  if (selectedVariant?.weightGrams ?? product.metalWeightGrams) {
    specRows.push({
      label: "Approx. Metal Weight",
      value: `${selectedVariant?.weightGrams ?? product.metalWeightGrams} g`,
    });
  }
  if (product.stoneOrigin) {
    specRows.push({ label: "Stone Origin", value: product.stoneOrigin });
  }
  if (product.stoneShape) {
    specRows.push({ label: "Cut Shape", value: product.stoneShape });
  }
  if (product.caratTotal) {
    specRows.push({
      label: "Total Carat Weight",
      value: `${product.caratTotal} ct`,
    });
  }
  if (product.caratCenter) {
    specRows.push({
      label: "Centre Stone Carat",
      value: `${product.caratCenter} ct`,
    });
  }
  if (product.colorGrade) {
    specRows.push({ label: "Colour Grade", value: product.colorGrade });
  }
  if (product.clarityGrade) {
    specRows.push({ label: "Clarity Grade", value: product.clarityGrade });
  }
  if (product.cutGrade) {
    specRows.push({ label: "Cut Grade", value: product.cutGrade });
  }
  if (product.polishGrade || product.symmetryGrade) {
    specRows.push({
      label: "Polish / Symmetry",
      value: [product.polishGrade, product.symmetryGrade].filter(Boolean).join(" / "),
    });
  }
  if (product.fluorescence) {
    specRows.push({ label: "Fluorescence", value: product.fluorescence });
  }
  if (product.certificationLab) {
    specRows.push({
      label: "Laboratory Certification",
      value: product.certificateNumber
        ? `${product.certificationLab} · #${product.certificateNumber}`
        : product.certificationLab,
    });
  }
  for (const attr of product.attributes) {
    if (!specRows.some((r) => r.label.toLowerCase() === attr.facetName.toLowerCase())) {
      specRows.push({
        label: attr.facetName,
        value: attr.unit ? `${attr.valueLabel} ${attr.unit}` : attr.valueLabel,
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{product.categoryName}</Badge>
          {product.certificationLab && (
            <Badge variant="default" className="gap-1">
              <Award className="size-3 text-accent" aria-hidden="true" />
              <span>{product.certificationLab} Certified</span>
            </Badge>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            SKU: {selectedVariant?.sku ?? product.sku}
          </span>
        </div>

        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {product.name}
        </h1>

        {product.subtitle && (
          <p className="text-base leading-relaxed text-muted-foreground">{product.subtitle}</p>
        )}

        <div className="pt-2">
          <Price
            amount={selectedVariant?.price ?? product.basePrice}
            compareAtAmount={selectedVariant?.compareAtPrice ?? product.compareAtPrice}
            currency={currency}
            isPriceOnRequest={product.priceMode === "PRICE_ON_REQUEST"}
            size="lg"
          />
        </div>
      </div>

      {product.variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-[0.1em] text-foreground uppercase">
              {product.hasSizing ? "Select Size & Specification" : "Select Option"}
            </p>
            {product.hasSizing && (
              <Link
                href="/ring-size-guide"
                className="text-xs font-medium text-accent-text underline-offset-4 hover:underline"
              >
                Ring Size Guide
              </Link>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Product options"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {product.variants.map((variant) => {
              const selected = variant.id === selectedVariant?.id;
              const outOfStock = variant.availableStock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-between rounded-sm border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    selected
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-card text-foreground hover:border-accent/60",
                    outOfStock && !selected ? "opacity-70" : "",
                  )}
                >
                  <div>
                    <span className="block text-sm font-medium">{variant.title}</span>
                    {variant.stoneSpec && (
                      <span className="block text-xs text-muted-foreground">
                        {variant.stoneSpec}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums-price">
                    {outOfStock ? "Out of stock" : `${variant.availableStock} ready`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && product.priceMode === "FIXED" && (
        <div className="rounded-sm border border-border/80 bg-muted/35 px-4 py-3 text-sm">
          {availableStock > selectedVariant.lowStockThreshold && (
            <p className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                In vault and ready for insured dispatch
                {product.leadTimeDays
                  ? ` (ships in 1–2 days; custom orders ${product.leadTimeDays} days)`
                  : ""}
                .
              </span>
            </p>
          )}
          {availableStock > 0 && availableStock <= selectedVariant.lowStockThreshold && (
            <p className="flex items-center gap-2 font-medium text-warning">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Only {availableStock} remaining in this specification.</span>
            </p>
          )}
          {availableStock <= 0 && (
            <p className="text-muted-foreground">
              Currently reserved or out of stock. Request a bespoke studio build below
              {product.leadTimeDays ? ` (${product.leadTimeDays}-day crafting window)` : ""}.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {product.priceMode === "FIXED" && availableStock > 0 ? (
          <>
            <QuantityStepper
              value={safeQuantity}
              min={1}
              max={maxSelectableQty}
              onChange={setQuantity}
            />
            <Button
              type="button"
              size="lg"
              disabled={addingToBag || !selectedVariant}
              onClick={handleAddToBag}
              className="flex-1 gap-2 sm:min-w-48"
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              <span>{addingToBag ? "Adding to Bag…" : "Add to Bag"}</span>
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => setEnquiryOpen(true)}
            className="flex-1 gap-2 sm:min-w-56"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            <span>
              {product.priceMode === "PRICE_ON_REQUEST"
                ? "Request Private Valuation"
                : "Commission Made-to-Order"}
            </span>
          </Button>
        )}

        <WishlistToggleButton
          variantId={selectedVariant?.id ?? product.defaultVariantId}
          productName={product.name}
          mode="button"
        />

        {product.priceMode === "FIXED" && availableStock > 0 && (
          <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="lg" className="gap-2">
                <MessageSquare className="size-4" aria-hidden="true" />
                <span>Concierge Advice</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Private Concierge</DialogTitle>
                <DialogDescription>
                  Ask a gemologist about stone certificates, custom metal finishes, or sizing.
                </DialogDescription>
              </DialogHeader>
              <EnquiryForm
                defaultType="PRODUCT"
                productId={product.id}
                productName={product.name}
                onSuccess={() => setEnquiryOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {(product.priceMode !== "FIXED" || availableStock <= 0) && (
          <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {product.priceMode === "PRICE_ON_REQUEST"
                    ? "High Jewellery Consultation"
                    : "Bespoke Commission Enquiry"}
                </DialogTitle>
                <DialogDescription>
                  Receive personalised stone specifications, studio imagery, and availability
                  directly from our private client team.
                </DialogDescription>
              </DialogHeader>
              <EnquiryForm
                defaultType="BESPOKE"
                productId={product.id}
                productName={product.name}
                onSuccess={() => setEnquiryOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {product.description && (
        <section className="space-y-2 border-t border-border pt-6">
          <h2 className="font-sans text-editorial-label text-foreground">
            Design &amp; Provenance
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {product.description}
          </p>
        </section>
      )}

      {specRows.length > 0 && (
        <section className="space-y-3 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-editorial-label text-foreground">
              Gemological Dossier &amp; Craft Specifications
            </h2>
            {product.certificateUrl && (
              <a
                href={product.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline"
              >
                <span>View Lab Report</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
          <dl className="divide-y divide-border rounded-md border border-border bg-card">
            {specRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-1 px-4 py-2.5 text-sm sm:grid-cols-2 sm:gap-4"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="grid gap-3 border-t border-border pt-6 sm:grid-cols-3">
        <div className="rounded-sm border border-border bg-card p-3.5">
          <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-foreground">Independent Certification</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accompanied by official diamond dossier verification.
          </p>
        </div>
        <div className="rounded-sm border border-border bg-card p-3.5">
          <Truck className="size-4 text-accent" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-foreground">Insured Courier</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {freeShippingThreshold
              ? `Complimentary over ${formatMoney(freeShippingThreshold, currency)}. `
              : ""}
            Signature required from {formatMoney(signatureThreshold, currency)}.
          </p>
        </div>
        <div className="rounded-sm border border-border bg-card p-3.5">
          <RotateCcw className="size-4 text-accent" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-foreground">{returnWindowDays}-Day Returns</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Complimentary insured returns &amp; annual care inspection.
          </p>
        </div>
      </section>
    </div>
  );
}
