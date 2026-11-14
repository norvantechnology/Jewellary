"use client";
import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { Reveal, RevealStagger } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/storefront/ProductCard";
import { recordRecentlyViewedId, useRecentlyViewedIds } from "@/hooks/use-recently-viewed";
import type { PublicProductCardDTO } from "@/modules/catalog/catalog.public";

export function RecordRecentlyViewed({ productId }: { productId: string }) {
  React.useEffect(() => {
    recordRecentlyViewedId(productId);
  }, [productId]);

  return null;
}

export function RecentlyViewedProducts({
  excludeProductId,
  currency,
  prioritizeFirst = false,
}: {
  excludeProductId?: string;
  currency: string;
  /** Load the first card's image eagerly when this section is above the fold (e.g. empty bag). */
  prioritizeFirst?: boolean;
}) {
  const ui = useUiText();
  const ids = useRecentlyViewedIds(excludeProductId);
  const [products, setProducts] = React.useState<PublicProductCardDTO[]>([]);

  React.useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    const controller = new AbortController();
    const qs = new URLSearchParams({ ids: ids.join(",") });
    if (excludeProductId) qs.set("exclude", excludeProductId);

    fetch(`/api/products/recently-viewed?${qs.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: PublicProductCardDTO[] }>) : null))
      .then((data) => {
        if (data?.items) {
          setProducts(data.items);
        }
      })
      .catch(() => {
        // Ignore abort / network errors for supplementary shelf
      });

    return () => controller.abort();
  }, [ids, excludeProductId]);

  const visibleProducts = React.useMemo(
    () => (ids.length === 0 ? [] : products.filter((p) => ids.includes(p.id))),
    [ids, products],
  );

  if (visibleProducts.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="recently-viewed-heading"
      className="mt-10 border-t border-border pt-12 sm:mt-16"
    >
      <Reveal>
        <h2
          id="recently-viewed-heading"
          className="type-h2 font-display font-semibold text-foreground"
        >
          {ui.product.recentlyViewed}
        </h2>
      </Reveal>
      <RevealStagger className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {visibleProducts.map((item, idx) => (
          <ProductCard
            key={item.id}
            product={item}
            currency={currency}
            headingLevel="h3"
            priority={prioritizeFirst && idx === 0}
          />
        ))}
      </RevealStagger>
    </section>
  );
}
