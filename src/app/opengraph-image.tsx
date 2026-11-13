import { ImageResponse } from "next/og";
import { BRAND_PALETTE } from "@/lib/brand-palette";
import { getPublicStoreSettings } from "@/modules/settings/settings.service";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const settings = await getPublicStoreSettings().catch(() => null);
  const storeName = settings?.storeName ?? "Maison Aurelia";
  const tagline =
    settings?.tagline ??
    "Certified GIA & IGI diamond engagement rings crafted in 18K gold and 950 platinum.";
  const p = BRAND_PALETTE.light;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: `linear-gradient(135deg, ${p.bg} 0%, ${p.surface} 52%, ${p.bgAlt} 100%)`,
        color: p.text,
        border: `1px solid ${p.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 22,
            letterSpacing: "0.26em",
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
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: p.textMuted,
            border: `1px solid ${p.borderStrong}`,
            padding: "8px 16px",
            borderRadius: 999,
          }}
        >
          Fine Jewellery Atelier
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 940 }}>
        <div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.12, color: p.text }}>
          Certified Diamonds & Heirloom Craftsmanship
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.4, color: p.text2 }}>{tagline}</div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${p.border}`,
          paddingTop: 24,
          fontSize: 18,
          color: p.textMuted,
        }}
      >
        <span>GIA &amp; IGI Independently Certified</span>
        <span>Insured Global Courier · {settings?.returnWindowDays ?? 30}-Day Returns</span>
      </div>
    </div>,
    { ...size },
  );
}
