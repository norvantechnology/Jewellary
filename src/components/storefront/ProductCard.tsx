"use client";
import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Gem } from "lucide-react";
import { Price } from "@/components/shared/Price";
import { ProductCardActions } from "@/components/storefront/ProductCardActions";
import { WishlistToggleButton } from "@/components/storefront/WishlistToggleButton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicProductCardDTO } from "@/modules/catalog/catalog.public";

interface ProductCardProps {
  product: PublicProductCardDTO;
  currency?: string;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
  preload?: boolean;
  className?: string;
}

interface CardBadgeMeta {
  label: string;
  variant: "primary" | "new" | "signature";
}

function getCardBadge(
  product: PublicProductCardDTO,
  labels: { badgeOnRequest: string; badgeNew: string; badgeSignature: string },
): CardBadgeMeta | null {
  if (product.priceMode === "PRICE_ON_REQUEST") {
    return { label: labels.badgeOnRequest, variant: "primary" };
  }
  if (product.isNewArrival) {
    return { label: labels.badgeNew, variant: "new" };
  }
  if (product.isBestseller || product.isFeatured) {
    return { label: labels.badgeSignature, variant: "signature" };
  }
  return null;
}

const LOW_STOCK_THRESHOLD = 5;

export const ProductCard = React.memo(function ProductCard({
  product,
  currency = "USD",
  headingLevel = "h3",
  priority = false,
  preload = false,
  className,
}: ProductCardProps) {
  const ui = useUiText();
  const href = `/products/${product.slug}`;
  const primary = product.primaryImage;
  const secondary = product.secondaryImage;

  const primaryMetaParts: string[] = [];
  if (product.metalType) primaryMetaParts.push(product.metalType);
  if (product.caratTotal) primaryMetaParts.push(`${Number(product.caratTotal).toFixed(2)} ct`);
  const primaryMeta = primaryMetaParts.join(" · ");
  const fullMetaTitle = [primaryMeta, product.certificationLab].filter(Boolean).join(" · ");

  const badge = getCardBadge(product, ui.productCard);
  const isPriceOnRequest = product.priceMode === "PRICE_ON_REQUEST";
  const isOutOfStock =
    !isPriceOnRequest &&
    (product.totalAvailableStock <= 0 ||
      product.variants.every((variant) => variant.availableStock <= 0));
  const showLowStock =
    !isPriceOnRequest &&
    !isOutOfStock &&
    product.totalAvailableStock > 0 &&
    product.totalAvailableStock <= LOW_STOCK_THRESHOLD;
  const Heading = headingLevel;

  return (
    <article
      className={cn(
        "relative flex h-full scroll-mt-[calc(var(--site-header-h)+1rem)] flex-col rounded-xl border border-border bg-surface shadow-sm transition-[border-color,box-shadow,background-color] duration-200",
        !isOutOfStock &&
          "group lg:hover:border-border-strong lg:hover:shadow-md dark:lg:hover:bg-surface-2",
        className,
      )}
    >
      {/* 4:5 Studio Image Container */}
      <div
        data-product-media="true"
        className="ma-media-placeholder relative aspect-[4/5] w-full overflow-hidden rounded-t-xl"
      >
        {primary ? (
          <>
            <Image
              src={primary.mediumUrl ?? primary.url}
              alt={primary.altText ?? product.name}
              fill
              preload={priority || preload}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                "object-cover object-center dark:brightness-90",
                isOutOfStock ? "opacity-75 grayscale-[25%]" : "ma-product-media-img",
                !isOutOfStock && secondary && "ma-product-has-alt",
              )}
            />
            {!isOutOfStock && secondary && (
              <Image
                src={secondary.mediumUrl ?? secondary.url}
                alt={
                  secondary.altText ?? fill(ui.productCard.alternateViewAlt, { name: product.name })
                }
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="ma-product-secondary-img object-cover object-center dark:brightness-90"
              />
            )}
          </>
        ) : (
          <div
            className={cn(
              "flex size-full items-center justify-center",
              isOutOfStock && "opacity-75",
            )}
          >
            <Gem
              className="size-8 text-accent-text/55 dark:text-accent/55"
              strokeWidth={1.25}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Single capped badge (top-left, 8px inset) */}
        {badge && (
          <Badge
            variant={badge.variant}
            className="pointer-events-none absolute top-2 left-2 z-20 max-w-[calc(100%-4rem)] truncate px-2 py-0.5 text-xs leading-tight shadow-sm"
          >
            {badge.label}
          </Badge>
        )}

        {/* Quick-wishlist action (top-right, 8px inset, 36px circle / 44px hit target) */}
        <WishlistToggleButton
          variantId={product.defaultVariantId}
          productName={product.name}
          className="absolute top-2 right-2 z-20"
        />
      </div>

      {/* Card Body: 12px mobile -> 16px >=768 */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3 md:p-4">
        <p className="mb-1 hidden truncate text-[11px] font-medium tracking-[0.08em] text-text-muted uppercase min-[361px]:block">
          {product.categoryName}
        </p>

        <Heading className="mb-1 line-clamp-2 min-h-[2.7em] text-[15px] leading-[1.3] font-medium text-text sm:text-base">
          <Link
            href={href}
            className="rounded-sm transition-colors after:absolute after:inset-0 after:z-10 after:content-[''] hover:text-accent-text focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {product.name}
          </Link>
        </Heading>

        {(primaryMeta || product.certificationLab) && (
          <div className="space-y-0.5" title={fullMetaTitle}>
            {primaryMeta && (
              <p className="truncate text-xs leading-[1.35] text-text-muted min-[420px]:text-[13px]">
                {primaryMeta}
              </p>
            )}
            {product.certificationLab && (
              <p className="hidden truncate text-[11px] leading-tight text-text-muted sm:block">
                {product.certificationLab}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto space-y-2.5 pt-2 sm:pt-3">
          <div className="flex min-h-6 items-baseline justify-between gap-2">
            <Price
              amount={product.basePrice}
              compareAtAmount={product.compareAtPrice}
              currency={currency}
              isPriceOnRequest={isPriceOnRequest}
              size="md"
            />
            {showLowStock && (
              <span className="tabular-nums-price shrink-0 text-xs font-medium text-warning">
                {product.totalAvailableStock} left
              </span>
            )}
          </div>
          <div className="relative z-20 hidden sm:block">
            <ProductCardActions product={product} />
          </div>
        </div>
      </div>
    </article>
  );
});
