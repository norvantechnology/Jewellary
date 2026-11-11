import { ImageResponse } from "next/og";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const alt = "Maison Aurelia — Fine Jewellery & Certified Diamonds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const settings = await getPublicStoreSettings();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1E1915",
        color: "#FAF7F0",
        padding: "64px 72px",
        border: "12px solid #9A7532",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#D1AA62",
          }}
        >
          {settings.storeName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 16,
            color: "#C4B9A5",
          }}
        >
          GIA &amp; IGI Certified Atelier
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            lineHeight: 1.08,
            fontWeight: 600,
            color: "#FAF7F0",
          }}
        >
          Architectural Fine Jewellery &amp; Heirloom Diamonds
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            lineHeight: 1.4,
            color: "#DDD2BF",
            maxWidth: 960,
          }}
        >
          {settings.tagline ??
            "Handcrafted in recycled 18K gold and 950 platinum with transparent grading dossiers and insured courier delivery."}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #4A3D31",
          paddingTop: 24,
          fontSize: 18,
          color: "#D1AA62",
        }}
      >
        <span style={{ display: "flex" }}>18K Gold · 950 Platinum · Natural &amp; Lab-Grown</span>
        <span style={{ display: "flex" }}>{settings.returnWindowDays}-Day Insured Returns</span>
      </div>
    </div>,
    { ...size },
  );
}
