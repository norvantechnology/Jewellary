import { ImageResponse } from "next/og";
import { formatMoney } from "@/lib/money";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.public";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const alt = "Maison Aurelia Creation";
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
          background: "#FAF7F0",
          color: "#1E1915",
          fontSize: 48,
          border: "12px solid #9A7532",
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
        background: "#FAF7F0",
        color: "#1E1915",
        padding: "56px 68px",
        border: "12px solid #9A7532",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#7F5D22",
          }}
        >
          {settings.storeName} · {product.categoryName}
        </span>
        <span
          style={{
            display: "flex",
            fontSize: 16,
            padding: "8px 16px",
            border: "1px solid #9A7532",
            background: "#F4EDE0",
            color: "#5C4520",
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
            color: "#1E1915",
          }}
        >
          {product.name}
        </div>
        {product.subtitle && (
          <div style={{ display: "flex", fontSize: 24, color: "#574D43", maxWidth: 960 }}>
            {product.subtitle}
          </div>
        )}
        {specs && (
          <div style={{ display: "flex", fontSize: 20, color: "#7F5D22", marginTop: 4 }}>
            {specs}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #D9CCB7",
          paddingTop: 22,
        }}
      >
        <span style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#1E1915" }}>
          {priceLabel}
        </span>
        <span style={{ display: "flex", fontSize: 18, color: "#574D43" }}>
          Insured Courier Delivery · {settings.returnWindowDays}-Day Returns
        </span>
      </div>
    </div>,
    { ...size },
  );
}
