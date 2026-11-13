import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { resolveCategoryByPath } from "@/modules/catalog/catalog.public";
import { getActiveLandingFacet } from "@/modules/seo/seo.service";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const size = {
  width: 1200,
  height: 630,
};

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get("path") ?? "";
  const segments = pathParam
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  const settings = await getPublicStoreSettings().catch(() => null);
  const storeName = settings?.storeName ?? "Maison Aurelia";
  const p = BRAND_PALETTE.light;

  let heading = "All Fine Jewellery Collections";
  let subcopy = "Explore independently certified diamonds set in 18K gold and 950 platinum.";
  let countLabel = "Curated Collection";

  if (segments.length >= 2) {
    const parentPath = segments.slice(0, -1).join("/");
    const facetSlug = segments[segments.length - 1]!;
    const facet = await getActiveLandingFacet(parentPath, facetSlug).catch(() => null);
    if (facet) {
      heading = facet.h1 || facet.name;
      subcopy = facet.introCopy?.slice(0, 145) || subcopy;
      countLabel = "Curated Style Edit";
    }
  }

  if (segments.length > 0 && heading === "All Fine Jewellery Collections") {
    const resolved = await resolveCategoryByPath(segments.join("/")).catch(() => null);
    if (resolved?.kind === "category") {
      heading = resolved.category.name;
      subcopy = resolved.category.description?.slice(0, 145) || subcopy;
      countLabel = `${resolved.category.productCount} Atelier Pieces`;
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 72px",
        background: `linear-gradient(135deg, ${p.bg} 0%, ${p.surface} 55%, ${p.bgAlt} 100%)`,
        color: p.text,
        border: `1px solid ${p.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 20,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: p.accentText,
            fontWeight: 600,
          }}
        >
          {storeName}
        </span>
        <span
          style={{
            fontSize: 16,
            color: p.textMuted,
            border: `1px solid ${p.borderStrong}`,
            padding: "6px 14px",
            borderRadius: 999,
          }}
        >
          {countLabel}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 940 }}>
        <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.12, color: p.text }}>
          {heading}
        </div>
        <div style={{ fontSize: 25, lineHeight: 1.4, color: p.text2 }}>{subcopy}</div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: `1px solid ${p.border}`,
          paddingTop: 22,
          fontSize: 18,
          color: p.textMuted,
        }}
      >
        <span>GIA &amp; IGI Certified · 18K Gold &amp; 950 Platinum</span>
        <span>Complimentary Insured Global Delivery</span>
      </div>
    </div>,
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
