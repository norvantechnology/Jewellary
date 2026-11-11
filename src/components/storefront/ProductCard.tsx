import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/shared/Price";
import { WishlistToggleButton } from "@/components/storefront/WishlistToggleButton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicProductCardDTO } from "@/modules/catalog/catalog.public";

interface ProductCardProps {
  product: PublicProductCardDTO;
  currency?: string;
  priority?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  currency = "USD",
  priority = false,
  className,
}: ProductCardProps) {
  const href = `/products/${product.slug}`;
  const primary = product.primaryImage;
  const secondary = product.secondaryImage;

  const metaParts: string[] = [];
  if (product.metalType) metaParts.push(product.metalType);
  if (product.caratTotal) metaParts.push(`${Number(product.caratTotal).toFixed(2)} ct`);
  if (product.certificationLab) metaParts.push(product.certificationLab);

  let badgeText: string | null = null;
  if (product.priceMode === "PRICE_ON_REQUEST") {
    badgeText = "High Jewellery";
  } else if (product.isNewArrival) {
    badgeText = "New Arrival";
  } else if (product.isBestseller) {
    badgeText = "Signature";
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-md border border-border/70 bg-card transition-colors hover:border-accent/60",
        className,
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-t-md bg-muted/60">
        <Link
          href={href}
          aria-label={`View ${product.name}`}
          className="block size-full focus-visible:outline-2 focus-visible:outline-ring"
        >
          {primary ? (
            <>
              <Image
                src={primary.mediumUrl ?? primary.url}
                alt={primary.altText}
                fill
                priority={priority}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={cn(
                  "object-cover transition-all duration-500 group-hover:scale-[1.03]",
                  secondary ? "group-hover:opacity-0" : "",
                )}
              />
              {secondary && (
                <Image
                  src={secondary.mediumUrl ?? secondary.url}
                  alt={secondary.altText}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Imagery forthcoming
            </div>
          )}
        </Link>

        {badgeText && (
          <Badge
            variant="default"
            className="pointer-events-none absolute top-3 left-3 z-10 border border-border/70 bg-card/90 text-[10px] tracking-[0.08em] uppercase backdrop-blur-sm"
          >
            {badgeText}
          </Badge>
        )}

        <WishlistToggleButton
          variantId={product.defaultVariantId}
          productName={product.name}
          className="absolute top-2.5 right-2.5 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2.5 p-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {product.categoryName}
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug font-medium text-foreground">
            <Link
              href={href}
              className="underline-offset-4 transition-colors hover:text-accent-text hover:underline"
            >
              {product.name}
            </Link>
          </h3>
          {metaParts.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border/60 pt-2.5">
          <Price
            amount={product.basePrice}
            compareAtAmount={product.compareAtPrice}
            currency={currency}
            isPriceOnRequest={product.priceMode === "PRICE_ON_REQUEST"}
            size="sm"
          />
          {product.totalAvailableStock <= 0 && product.priceMode === "FIXED" && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {product.leadTimeDays ? `Atelier (${product.leadTimeDays}d)` : "Waitlist"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
