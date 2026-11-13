import { ImageResponse } from "next/og";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { formatMoney } from "@/lib/money";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const alt = `${process.env.NEXT_PUBLIC_SITE_NAME ?? "Atelier Fine Jewellery"} Creation`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, settings] = await Promise.all([params, getPublicStoreSettings()]);
  const resolved = await getPublicProductBySlug(slug);

  if (!resolved || resolved.kind !== "product") {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_PALETTE.light.bg,
          color: BRAND_PALETTE.light.text,
          fontSize: 48,
          border: `12px solid ${BRAND_PALETTE.light.accent}`,
        }}
      >
        {settings.storeName}
      </div>,
      { ...size },
    );
  }

  const { product } = resolved;
  const priceLabel =
    product.priceMode === "PRICE_ON_REQUEST"
      ? "Available by Private Enquiry"
      : formatMoney(product.basePrice, settings.currency);

  const specs = [
    product.metalType,
    product.caratTotal ? `${Number(product.caratTotal).toFixed(2)} ct` : null,
    product.clarityGrade && product.colorGrade
      ? `${product.colorGrade} / ${product.clarityGrade}`
      : null,
    product.certificationLab ? `${product.certificationLab} Certified` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BRAND_PALETTE.light.bg,
        color: BRAND_PALETTE.light.text,
        padding: "56px 68px",
        border: `12px solid ${BRAND_PALETTE.light.accent}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: BRAND_PALETTE.light.accentText,
          }}
        >
          {settings.storeName} · {product.categoryName}
        </span>
        <span
          style={{
            display: "flex",
            fontSize: 16,
            padding: "8px 16px",
            border: `1px solid ${BRAND_PALETTE.light.accent}`,
            background: BRAND_PALETTE.light.bgAlt,
            color: BRAND_PALETTE.light.accentText,
          }}
        >
          {product.sku}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontSize: 56,
            lineHeight: 1.1,
            fontWeight: 600,
            color: BRAND_PALETTE.light.text,
          }}
        >
          {product.name}
        </div>
        {product.subtitle && (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: BRAND_PALETTE.light.text2,
              maxWidth: 960,
            }}
          >
            {product.subtitle}
          </div>
        )}
        {specs && (
          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: BRAND_PALETTE.light.accentText,
              marginTop: 4,
            }}
          >
            {specs}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${BRAND_PALETTE.light.border}`,
          paddingTop: 22,
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 600,
            color: BRAND_PALETTE.light.text,
          }}
        >
          {priceLabel}
        </span>
        <span style={{ display: "flex", fontSize: 18, color: BRAND_PALETTE.light.text2 }}>
          Insured Courier Delivery · {settings.returnWindowDays}-Day Returns
        </span>
      </div>
    </div>,
    { ...size },
  );
}
